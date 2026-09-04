#include <windows.h>
#include <iostream>

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Devices.Midi2.h>
#include <winrt/Windows.Devices.Midi2.Transports.Loopback.h>

using namespace winrt::Windows::Devices::Midi2;
using namespace winrt::Windows::Devices::Midi2::Transports::Loopback;

namespace {
constexpr wchar_t SendName[] = L"Folio to REAPER";
constexpr wchar_t ReceiveName[] = L"REAPER from Folio";
HANDLE stopEvent = nullptr;

BOOL WINAPI consoleSignal(DWORD)
{
    if (stopEvent) SetEvent(stopEvent);
    return TRUE;
}

bool sameName(winrt::hstring const& value, wchar_t const* expected)
{
    return _wcsicmp(value.c_str(), expected) == 0;
}

bool isFolioBridge(MidiLoopbackEntry const& entry)
{
    return sameName(entry.EndpointA().Name(), SendName) ||
           sameName(entry.EndpointB().Name(), ReceiveName);
}

void removeOldBridge()
{
    bool removedAny = false;
    for (auto const& entry : MidiLoopbackManager::GetActiveLoopbackEntries())
    {
        if (isFolioBridge(entry))
        {
            MidiLoopbackRemovalConfig removal{ entry.AssociationId() };
            auto removed = MidiLoopbackManager::RemoveTransientLoopback(removal);
            if (!removed.Success())
            {
                std::wcerr << L"Could not remove stale Folio MIDI endpoints: "
                           << removed.ErrorMessage().c_str() << std::endl;
            }
            else
            {
                removedAny = true;
            }
        }
    }

    // Removal is serviced out of process. A successful call can return before
    // the endpoint names are available for reuse, particularly after a prior
    // owner was force-terminated. Do not race our own cleanup.
    if (removedAny)
    {
        for (int attempt = 0; attempt < 40; ++attempt)
        {
            bool stillPresent = false;
            for (auto const& entry : MidiLoopbackManager::GetActiveLoopbackEntries())
            {
                if (isFolioBridge(entry)) { stillPresent = true; break; }
            }
            if (!stillPresent) return;
            Sleep(250);
        }
        std::wcerr << L"Stale Folio MIDI endpoints remained after cleanup." << std::endl;
    }
}
}

int wmain()
{
    HANDLE mutex = CreateMutexW(nullptr, TRUE, L"Local\\FolioReaperBridgeMutex");
    if (!mutex || GetLastError() == ERROR_ALREADY_EXISTS) return 3;

    HANDLE readyEvent = CreateEventW(nullptr, TRUE, FALSE, L"Local\\FolioReaperReady");
    stopEvent = CreateEventW(nullptr, TRUE, FALSE, L"Local\\FolioReaperStop");
    if (!readyEvent || !stopEvent) return 4;
    ResetEvent(readyEvent);
    ResetEvent(stopEvent);
    SetConsoleCtrlHandler(consoleSignal, TRUE);

    winrt::init_apartment();
    int result = 1;

    try
    {
        if (!MidiApi::EnsureServiceAvailable() || !MidiLoopbackManager::IsTransportAvailable())
            throw winrt::hresult_error(E_FAIL, L"Windows MIDI loopback transport is unavailable");

        removeOldBridge();

        auto session = MidiSession::Create(L"Folio sound bridge");
        MidiLoopbackEndpointDefinition send(SendName, L"Folio sends notes here", L"FolioSend");
        MidiLoopbackEndpointDefinition receive(ReceiveName, L"REAPER listens here", L"FolioReceive");
        MidiLoopbackCreationConfig config(send, receive);
        auto created = MidiLoopbackManager::CreateTransientLoopback(config);

        if (!created.Success())
        {
            std::wcerr << L"Could not create Folio MIDI endpoints: "
                       << created.ErrorMessage().c_str() << std::endl;
        }
        else
        {
            SetEvent(readyEvent);
            std::wcout << L"READY " << SendName << L" -> " << ReceiveName << std::endl;
            WaitForSingleObject(stopEvent, INFINITE);

            MidiLoopbackRemovalConfig removal{ created.CreatedLoopbackEntry().AssociationId() };
            auto removed = MidiLoopbackManager::RemoveTransientLoopback(removal);
            result = removed.Success() ? 0 : 2;
        }

        session.Close();
    }
    catch (winrt::hresult_error const& error)
    {
        std::wcerr << L"Folio MIDI bridge failed: " << error.message().c_str() << std::endl;
    }

    winrt::uninit_apartment();
    CloseHandle(stopEvent);
    CloseHandle(readyEvent);
    ReleaseMutex(mutex);
    CloseHandle(mutex);
    return result;
}
