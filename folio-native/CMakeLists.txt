cmake_minimum_required(VERSION 3.22)
project(FolioNative VERSION 0.1.0)

# JUCE is a shallow clone beside this file (git clone --depth 1 --branch 8.0.10
# https://github.com/juce-framework/JUCE.git JUCE), and the WebView2 SDK is the
# unzipped NuGet package under deps/. Neither is checked in.
add_subdirectory(JUCE)
set(JUCE_WEBVIEW2_PACKAGE_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/deps" CACHE PATH "" FORCE)

juce_add_gui_app(FolioNative
    PRODUCT_NAME "Folio"
    COMPANY_NAME "Folio"
    NEEDS_WEBVIEW2 TRUE)

target_sources(FolioNative PRIVATE Source/Main.cpp Source/Rack.cpp)

target_compile_definitions(FolioNative PRIVATE
    JUCE_WEB_BROWSER=1
    JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
    JUCE_USE_CURL=0
    JUCE_APPLICATION_NAME_STRING="$<TARGET_PROPERTY:FolioNative,JUCE_PRODUCT_NAME>"
    JUCE_APPLICATION_VERSION_STRING="$<TARGET_PROPERTY:FolioNative,JUCE_VERSION>"
    JUCE_PLUGINHOST_VST3=1
    JUCE_PLUGINHOST_VST=0
    JUCE_PLUGINHOST_AU=0
    JUCE_PLUGINHOST_LADSPA=0
    JUCE_PLUGINHOST_LV2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
    FOLIO_NATIVE_DIR="${CMAKE_CURRENT_SOURCE_DIR}")

target_compile_options(FolioNative PRIVATE /utf-8)

target_link_libraries(FolioNative PRIVATE
    juce::juce_gui_extra
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_audio_devices
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags)
