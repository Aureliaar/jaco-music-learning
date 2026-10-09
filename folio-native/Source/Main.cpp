/* Folio Native: the folio's own page in a window, and the rack in the same
   process. The page is exactly the one the local server serves; the only
   thing it learns here is that window.__JUCE__ exists, and js/audio.js sends
   its notes to the rack through it instead of down a MIDI cable. */
#include "Rack.h"
#include <cstdlib>

using namespace juce;

static File appData()
{
    return File::getSpecialLocation (File::userApplicationDataDirectory).getChildFile ("Folio Native");
}

//==============================================================================
class PluginWindow : public DocumentWindow
{
public:
    PluginWindow (AudioPluginInstance& p, const String& title, std::function<void()> onClose)
        : DocumentWindow (title, Colours::darkgrey, DocumentWindow::closeButton), closed (std::move (onClose))
    {
        setUsingNativeTitleBar (true);
        if (auto* editor = p.createEditorIfNeeded())
            setContentOwned (editor, true);
        setResizable (false, false);
        centreWithSize (jmax (300, getWidth()), jmax (200, getHeight()));
        setVisible (true);
    }
    void closeButtonPressed() override { closed(); }

private:
    std::function<void()> closed;
};

//==============================================================================
class FolioView : public WebBrowserComponent
{
public:
    FolioView (Rack& r, const String& startUrl)
        : WebBrowserComponent (options (r)), url (startUrl)
    {
        goToURL (url);
    }

    bool pageLoadHadNetworkError (const String& error) override
    {
        /* A down server may be deliberate (a disk write, a migration), so the
           window never starts one; it says what is missing and waits. */
        const String html =
            "<!doctype html><meta charset=utf-8><body style=\"background:#efe6d2;color:#3b3226;"
            "font:18px Georgia,serif;display:flex;align-items:center;justify-content:center;height:90vh\">"
            "<div style=\"max-width:32em\"><p><b>The folio server is not running.</b></p>"
            "<p>Start it with <code>folio.cmd</code>, then choose Rack &rarr; Reload page. "
            "Your music is safe.</p><p style=\"opacity:.6;font-size:14px\">" + error + "</p></div>";
        goToURL ("data:text/html;charset=utf-8," + URL::addEscapeChars (html, false));
        return false;
    }

    void newWindowAttemptingToLoad (const String& newUrl) override { URL (newUrl).launchInDefaultBrowser(); }

    void reload() { goToURL (url); }

private:
    static Options options (Rack& rack)
    {
        return Options{}
            .withBackend (Options::Backend::webview2)
            .withWinWebView2Options (Options::WinWebView2{}
                                         .withUserDataFolder (appData().getChildFile ("WebView2"))
                                         .withStatusBarDisabled()
                                         .withBackgroundColour (Colour (0xffefe6d2)))
            .withNativeIntegrationEnabled()
            .withEventListener ("folioMidi", [&rack] (var message)
            {
                if (auto* events = message["events"].getArray())
                    rack.enqueue (*events, (double) message["now"]);
            })
            .withNativeFunction ("folioRack", [&rack] (const Array<var>&, NativeFunctionCompletion done)
            {
                done (rack.status());
            });
    }

    String url;
};

//==============================================================================
class MainWindow : public DocumentWindow, private MenuBarModel
{
public:
    MainWindow (Rack& r, const String& url)
        : DocumentWindow ("Folio", Colour (0xffefe6d2), DocumentWindow::allButtons), rack (r)
    {
        setUsingNativeTitleBar (true);
        setMenuBar (this);
        view = new FolioView (rack, url);
        setContentOwned (view, false);
        setResizable (true, false);
        if (! restoreWindowStateFromString (appData().getChildFile ("window.txt").loadFileAsString()))
            centreWithSize (1400, 900);
        setVisible (true);
    }

    ~MainWindow() override
    {
        appData().createDirectory();
        appData().getChildFile ("window.txt").replaceWithText (getWindowStateAsString());
        editors.clear();
        setMenuBar (nullptr);
    }

    void closeButtonPressed() override { JUCEApplication::getInstance()->systemRequestedQuit(); }

private:
    enum { audioSettings = 1, reloadPage, saveStates, instrumentBase = 100 };

    StringArray getMenuBarNames() override { return { "Rack" }; }

    PopupMenu getMenuForIndex (int, const String&) override
    {
        PopupMenu m;
        m.addItem (audioSettings, "Audio settings...");
        m.addItem (reloadPage, "Reload page");
        m.addSeparator();
        int k = 0;
        for (auto& i : rack.instruments())
            m.addItem (instrumentBase + k++,
                       String ("Open ") + i->name + " (MIDI " + String (i->channel + 1) + ")");
        if (rack.instruments().empty())
            m.addItem (-1, rack.isReady() ? "No instruments" : "Instruments loading...", false);
        m.addSeparator();
        m.addItem (saveStates, "Save instrument states", rack.isReady());
        return m;
    }

    void menuItemSelected (int id, int) override
    {
        if (id == audioSettings)
        {
            auto* selector = new AudioDeviceSelectorComponent (rack.devices(), 0, 0, 2, 2, false, false, true, false);
            selector->setSize (500, 400);
            DialogWindow::LaunchOptions o;
            o.content.setOwned (selector);
            o.dialogTitle = "Audio settings";
            o.useNativeTitleBar = true;
            o.resizable = false;
            o.launchAsync();
        }
        else if (id == reloadPage)
        {
            view->reload();
        }
        else if (id == saveStates)
        {
            auto result = rack.saveStates();
            AlertWindow::showMessageBoxAsync (result.wasOk() ? MessageBoxIconType::InfoIcon : MessageBoxIconType::WarningIcon,
                                              "Instrument states",
                                              result.wasOk() ? "Saved beside rack.json." : result.getErrorMessage());
        }
        else if (id >= instrumentBase)
        {
            const auto index = (size_t) (id - instrumentBase);
            if (index >= rack.instruments().size()) return;
            auto& inst = *rack.instruments()[index];
            auto* key = inst.plugin.get();
            if (editors.count (key)) { editors[key]->toFront (true); return; }
            editors[key] = std::make_unique<PluginWindow> (*inst.plugin, inst.name + " (MIDI " + String (inst.channel + 1) + ")",
                [this, key] { MessageManager::callAsync ([this, key] { editors.erase (key); }); });
        }
    }

    Rack& rack;
    FolioView* view = nullptr;
    std::map<AudioPluginInstance*, std::unique_ptr<PluginWindow>> editors;
};

//==============================================================================
class FolioApplication : public JUCEApplication
{
public:
    const String getApplicationName() override    { return "Folio"; }
    const String getApplicationVersion() override { return "0.1.0"; }
    bool moreThanOneInstanceAllowed() override    { return false; }

    void initialise (const String& commandLine) override
    {
        /* Folio's scheduler runs on the page's AudioContext clock even though
           the rack makes the sound, and a pad-only session never makes the
           gesture Chrome's autoplay policy waits for. */
        String args ("--autoplay-policy=no-user-gesture-required");
        /* FOLIO_NATIVE_DEVTOOLS=<port> opens the page to a CDP client (tests/cdp.js) */
        if (auto* port = std::getenv ("FOLIO_NATIVE_DEVTOOLS"))
            args << " --remote-debugging-port=" << port;
        _putenv_s ("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", args.toRawUTF8());

        auto url = commandLine.unquoted().trim();
        if (! url.startsWithIgnoreCase ("http"))
            url = "http://localhost:4173/";

        rack = std::make_unique<Rack>();
        window = std::make_unique<MainWindow> (*rack, url);
        rack->start();
    }

    void shutdown() override
    {
        window = nullptr;
        rack = nullptr;
    }

    void systemRequestedQuit() override { quit(); }

    void anotherInstanceStarted (const String&) override
    {
        if (window != nullptr) window->toFront (true);
    }

private:
    std::unique_ptr<Rack> rack;
    std::unique_ptr<MainWindow> window;
};

START_JUCE_APPLICATION (FolioApplication)
