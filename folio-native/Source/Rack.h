#pragma once
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include <array>
#include <atomic>

/* The rack: the plugins Folio's notes are played on, in this process.

   Folio is still the clock. The page sends MIDI bytes stamped with the time
   they are to sound, in the page's own epoch milliseconds
   (performance.timeOrigin + the Web MIDI timestamp). The audio callback keeps
   a running map from the wall clock to its own sample counter and lands each
   event on the sample it names, so the bridge's few milliseconds of delivery
   are absorbed by Folio's lookahead instead of being heard.

   Channels are the REAPER rack's, unchanged: voice + seat * 3, one instrument
   a channel, rewritten to channel 1 on the way in because SINE's saved
   instruments listen there. */
class Rack : public juce::AudioIODeviceCallback
{
public:
    struct Instrument
    {
        int channel = 0;   // 0-based MIDI channel Folio sends on
        int voice = 0, seat = 0;
        juce::String name, stateFile;
        float gain = 1.0f;
        std::unique_ptr<juce::AudioPluginInstance> plugin;
        juce::AudioBuffer<float> scratch;
        juce::MidiBuffer midi;
    };

    Rack();
    ~Rack() override;

    /* Opens the audio device, then loads the instruments one by one off the
       message thread's queue so the window stays alive while SINE loads. */
    void start();

    /* From the page. `flat` is [epochMs, status, d1, d2, ...]; an epochMs of
       0 means at once, and of -1 means clear everything still queued (Web
       MIDI's MIDIOutput.clear()). Message thread only. */
    void enqueue (const juce::Array<juce::var>& flat, double pageNowMs);

    /* What the page reads in place of /api/renderer. */
    juce::var status() const;

    juce::AudioDeviceManager& devices() { return deviceManager; }
    const std::vector<std::unique_ptr<Instrument>>& instruments() const { return rack; }
    bool isReady() const { return ready.load(); }

    /* Writes every instrument's current state next to rack.json and points
       rack.json at it, so an instrument set up in its own editor survives. */
    juce::Result saveStates();

    // AudioIODeviceCallback
    void audioDeviceIOCallbackWithContext (const float* const*, int, float* const*, int, int,
                                           const juce::AudioIODeviceCallbackContext&) override;
    void audioDeviceAboutToStart (juce::AudioIODevice*) override;
    void audioDeviceStopped() override;

private:
    struct Event { double epochMs; juce::uint8 bytes[3]; juce::uint8 size; };

    void loadNext();
    void fail (const juce::String& state, const juce::String& detail);
    static double epochNowMs();

    juce::AudioDeviceManager deviceManager;
    juce::AudioPluginFormatManager formats;
    juce::File dir, rackJson;
    juce::var manifest;
    juce::PluginDescription description;
    juce::String pluginPath;
    int loading = 0;

    std::vector<std::unique_ptr<Instrument>> rack;
    std::atomic<bool> ready { false };
    juce::String state { "starting" }, detail;

    // page → audio thread
    static constexpr int fifoSize = 8192;
    juce::AbstractFifo fifo { fifoSize };
    std::array<Event, fifoSize> fifoData;
    std::vector<Event> pending;   // audio thread only

    // audio thread state
    juce::CriticalSection renderLock;
    double sampleRate = 48000.0;
    int blockSize = 512;
    juce::int64 samplePos = 0;
    double clockOffsetMs = 0.0;
    bool clockSet = false;

    // diagnostics, read by status()
    std::atomic<int> lateEvents { 0 };
    std::atomic<double> lastLeadMs { 0.0 }, bridgeMs { 0.0 };
    std::atomic<float> peak { 0.0f };   // loudest output sample since status() last asked
};
