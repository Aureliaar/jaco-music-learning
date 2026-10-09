#include "Rack.h"
#include <chrono>

using namespace juce;

static File appData()
{
    return File::getSpecialLocation (File::userApplicationDataDirectory).getChildFile ("Folio Native");
}

Rack::Rack()
{
    formats.addFormat (new VST3PluginFormat());
    pending.reserve (fifoSize);
}

Rack::~Rack()
{
    deviceManager.removeAudioCallback (this);
    if (auto xml = deviceManager.createStateXml())
    {
        appData().createDirectory();
        xml->writeTo (appData().getChildFile ("audio.xml"));
    }
    const ScopedLock sl (renderLock);
    for (auto& i : rack)
        if (i->plugin != nullptr)
            i->plugin->releaseResources();
    rack.clear();
}

double Rack::epochNowMs()
{
    /* MSVC's system_clock is GetSystemTimePreciseAsFileTime: the same wall
       clock the page's performance.timeOrigin is read from. */
    using namespace std::chrono;
    return (double) duration_cast<microseconds> (system_clock::now().time_since_epoch()).count() / 1000.0;
}

void Rack::fail (const String& s, const String& d)
{
    state = s;
    detail = d;
    DBG ("rack: " << s << " · " << d);
}

void Rack::start()
{
    dir = File (FOLIO_NATIVE_DIR).getChildFile ("rack");
    rackJson = dir.getChildFile ("rack.json");

    std::unique_ptr<XmlElement> saved;
    auto settings = appData().getChildFile ("audio.xml");
    if (settings.existsAsFile())
        saved = parseXML (settings);

    auto err = deviceManager.initialise (0, 2, saved.get(), true);
    if (err.isNotEmpty() || deviceManager.getCurrentAudioDevice() == nullptr)
        return fail ("audio-failed", err.isNotEmpty() ? err : "no audio output device");

    deviceManager.addAudioCallback (this);

    if (! rackJson.existsAsFile())
        return fail ("rack-missing", rackJson.getFullPathName());

    manifest = JSON::parse (rackJson);
    auto* list = manifest["instruments"].getArray();
    if (list == nullptr || list->isEmpty())
        return fail ("rack-missing", "rack.json lists no instruments");

    loading = 0;
    loadNext();
}

void Rack::loadNext()
{
    auto* list = manifest["instruments"].getArray();
    if (loading >= list->size())
    {
        ready = true;
        state = "ready";
        detail = {};
        return;
    }

    auto entry = (*list)[loading];
    auto file = File::getSpecialLocation (File::globalApplicationsDirectory)   // C:\Program Files
                    .getChildFile ("Common Files").getChildFile ("VST3")
                    .getChildFile (entry["plugin"].toString());
    if (! file.exists())
        return fail ("plugin-missing", file.getFullPathName());

    OwnedArray<PluginDescription> found;
    for (auto* format : formats.getFormats())
        format->findAllTypesForFile (found, file.getFullPathName());
    if (found.isEmpty())
        return fail ("plugin-missing", "no VST3 instrument in " + file.getFullPathName());

    auto* device = deviceManager.getCurrentAudioDevice();
    const auto sr = device->getCurrentSampleRate();
    const auto bs = device->getCurrentBufferSizeSamples();

    formats.createPluginInstanceAsync (*found.getFirst(), sr, bs,
        [this, entry, sr, bs] (std::unique_ptr<AudioPluginInstance> plugin, const String& error)
        {
            if (plugin == nullptr)
                return fail ("plugin-failed", entry["name"].toString() + ": " + error);

            auto inst = std::make_unique<Instrument>();
            inst->channel = (int) entry["channel"] - 1;
            inst->voice = (int) entry["voice"];
            inst->seat = (int) entry["seat"];
            inst->name = entry["name"].toString();
            inst->stateFile = entry["state"].toString();
            inst->gain = entry.hasProperty ("gain") ? (float) (double) entry["gain"] : 1.0f;

            plugin->enableAllBuses();

            MemoryBlock bytes;
            if (inst->stateFile.isNotEmpty() && dir.getChildFile (inst->stateFile).loadFileAsData (bytes))
            {
                if (inst->stateFile.endsWithIgnoreCase (".component"))
                {
                    /* A bare IComponent state lifted out of REAPER: wrap it the
                       way JUCE's own VST3 host stores one. */
                    XmlElement xml ("VST3PluginState");
                    xml.createNewChildElement ("IComponent")->addTextElement (bytes.toBase64Encoding());
                    MemoryBlock wrapped;
                    AudioProcessor::copyXmlToBinary (xml, wrapped);
                    plugin->setStateInformation (wrapped.getData(), (int) wrapped.getSize());
                }
                else
                {
                    plugin->setStateInformation (bytes.getData(), (int) bytes.getSize());
                }
            }

            plugin->setRateAndBufferSizeDetails (sr, bs);
            plugin->prepareToPlay (sr, bs);
            const int ch = jmax (2, plugin->getTotalNumInputChannels(), plugin->getTotalNumOutputChannels());
            inst->scratch.setSize (ch, jmax (bs, 4096));
            inst->midi.ensureSize (2048);
            inst->plugin = std::move (plugin);

            {
                const ScopedLock sl (renderLock);
                rack.push_back (std::move (inst));
            }
            ++loading;
            loadNext();
        });
}

void Rack::enqueue (const Array<var>& flat, double pageNowMs)
{
    const auto now = epochNowMs();
    if (pageNowMs > 0)
        bridgeMs = now - pageNowMs;

    for (int i = 0; i + 3 < flat.size(); i += 4)
    {
        Event e;
        e.epochMs = (double) flat[i];
        e.size = 3;
        for (int k = 0; k < 3; ++k)
            e.bytes[k] = (uint8) (int) flat[i + 1 + k];
        if (e.epochMs > 0)
            lastLeadMs = e.epochMs - now;

        auto scope = fifo.write (1);
        if (scope.blockSize1 > 0) fifoData[(size_t) scope.startIndex1] = e;
        else if (scope.blockSize2 > 0) fifoData[(size_t) scope.startIndex2] = e;
    }
}

void Rack::audioDeviceAboutToStart (AudioIODevice* device)
{
    const ScopedLock sl (renderLock);
    sampleRate = device->getCurrentSampleRate();
    blockSize = device->getCurrentBufferSizeSamples();
    clockSet = false;
    for (auto& i : rack)
    {
        i->plugin->releaseResources();
        i->plugin->setRateAndBufferSizeDetails (sampleRate, blockSize);
        i->plugin->prepareToPlay (sampleRate, blockSize);
        i->scratch.setSize (i->scratch.getNumChannels(), jmax (blockSize, 4096));
    }
}

void Rack::audioDeviceStopped()
{
    clockSet = false;
}

void Rack::audioDeviceIOCallbackWithContext (const float* const*, int, float* const* out, int numOut,
                                             int n, const AudioIODeviceCallbackContext&)
{
    for (int c = 0; c < numOut; ++c)
        if (out[c] != nullptr)
            FloatVectorOperations::clear (out[c], n);

    /* the wall clock → sample map, nudged gently so one late callback does
       not drag every note after it */
    const auto now = epochNowMs();
    const auto blockMs = (double) samplePos * 1000.0 / sampleRate;
    const auto offset = now - blockMs;
    if (! clockSet || std::abs (offset - clockOffsetMs) > 50.0)
    {
        clockOffsetMs = offset;
        clockSet = true;
    }
    else
    {
        clockOffsetMs += 0.002 * (offset - clockOffsetMs);
    }

    fifo.read (fifo.getNumReady()).forEach ([this] (int index)
    {
        const auto& e = fifoData[(size_t) index];
        if (e.epochMs < 0) pending.clear();
        else if (pending.size() < pending.capacity()) pending.push_back (e);
    });

    const ScopedTryLock sl (renderLock);
    if (! sl.isLocked())
    {
        samplePos += n;
        return;
    }

    for (auto& i : rack)
        i->midi.clear();

    const auto blockEnd = samplePos + n;
    size_t keep = 0;
    for (size_t k = 0; k < pending.size(); ++k)
    {
        const auto& e = pending[k];
        auto at = e.epochMs <= 0 ? samplePos
                                 : (int64) std::llround ((e.epochMs - clockOffsetMs) * sampleRate / 1000.0);
        if (at >= blockEnd)
        {
            pending[keep++] = e;
            continue;
        }
        if (at < samplePos)
        {
            if (e.epochMs > 0) ++lateEvents;
            at = samplePos;
        }
        const auto status = e.bytes[0];
        if (status >= 0xF0)
            continue;
        const int ch = status & 0x0F;
        for (auto& i : rack)
        {
            if (i->channel != ch) continue;
            uint8 b[3] = { (uint8) (status & 0xF0), e.bytes[1], e.bytes[2] };
            i->midi.addEvent (b, e.size, (int) (at - samplePos));
        }
    }
    pending.resize (keep);

    for (auto& i : rack)
    {
        auto& s = i->scratch;
        if (s.getNumSamples() < n)
            s.setSize (s.getNumChannels(), n, false, false, true);
        AudioBuffer<float> view (s.getArrayOfWritePointers(), s.getNumChannels(), n);
        view.clear();
        i->plugin->processBlock (view, i->midi);
        for (int c = 0; c < jmin (numOut, 2); ++c)
            if (out[c] != nullptr)
                FloatVectorOperations::addWithMultiply (out[c], view.getReadPointer (jmin (c, view.getNumChannels() - 1)),
                                                        i->gain, n);
    }

    for (int c = 0; c < jmin (numOut, 2); ++c)
        if (out[c] != nullptr)
        {
            const auto r = FloatVectorOperations::findMinAndMax (out[c], n);
            const auto p = jmax (std::abs (r.getStart()), std::abs (r.getEnd()));
            if (p > peak.load()) peak = p;
        }

    samplePos = blockEnd;
}

var Rack::status() const
{
    auto* o = new DynamicObject();
    o->setProperty ("state", state);
    o->setProperty ("detail", detail);

    if (ready)
    {
        Array<var> voices;
        for (int v = 0; v < 3; ++v)
        {
            Array<var> seats;
            for (auto& i : rack)
            {
                if (i->voice != v) continue;
                auto* s = new DynamicObject();
                s->setProperty ("seat", i->seat);
                s->setProperty ("name", i->name);
                seats.add (var (s));
            }
            voices.add (seats);
        }
        o->setProperty ("voices", voices);
    }

    if (auto* device = const_cast<AudioDeviceManager&> (deviceManager).getCurrentAudioDevice())
    {
        o->setProperty ("device", device->getName());
        o->setProperty ("sampleRate", device->getCurrentSampleRate());
        o->setProperty ("blockSize", device->getCurrentBufferSizeSamples());
        o->setProperty ("outputLatencyMs", device->getOutputLatencyInSamples() * 1000.0 / device->getCurrentSampleRate());
    }
    o->setProperty ("bridgeMs", bridgeMs.load());
    o->setProperty ("leadMs", lastLeadMs.load());
    o->setProperty ("late", lateEvents.load());
    o->setProperty ("peak", const_cast<std::atomic<float>&> (peak).exchange (0.0f));
    return var (o);
}

Result Rack::saveStates()
{
    auto* list = manifest["instruments"].getArray();
    if (list == nullptr)
        return Result::fail ("no rack loaded");

    for (auto& i : rack)
    {
        MemoryBlock bytes;
        i->plugin->getStateInformation (bytes);
        const auto name = String::formatted ("%02d.state", i->channel + 1);
        if (! dir.getChildFile (name).replaceWithData (bytes.getData(), bytes.getSize()))
            return Result::fail ("could not write " + name);
        i->stateFile = name;
        for (auto& entry : *list)
            if ((int) entry["channel"] == i->channel + 1)
                if (auto* obj = entry.getDynamicObject())
                    obj->setProperty ("state", name);
    }

    if (! rackJson.replaceWithText (JSON::toString (manifest)))
        return Result::fail ("could not write rack.json");
    return Result::ok();
}
