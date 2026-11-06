import ExpoModulesCore

/// JS side: src/platform/expo/watch.ts.
public class StrydeWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StrydeWatch")

    Events("onSample", "onState")

    OnStartObserving { [weak self] in
      WatchBridge.shared.onSample = { sample in self?.sendEvent("onSample", sample) }
      WatchBridge.shared.onState = { state in self?.sendEvent("onState", ["state": state]) }
    }

    OnStopObserving {
      WatchBridge.shared.onSample = nil
      WatchBridge.shared.onState = nil
    }

    AsyncFunction("status") { () async -> String in
      await WatchBridge.shared.status()
    }

    AsyncFunction("requestAccess") { () async -> String in
      await WatchBridge.shared.requestAccess()
    }

    AsyncFunction("start") { (sport: String) async -> Bool in
      await WatchBridge.shared.start(sport: sport)
    }

    AsyncFunction("pause") { WatchBridge.shared.pause() }
    AsyncFunction("resume") { WatchBridge.shared.resume() }
    AsyncFunction("end") { WatchBridge.shared.end() }
  }
}
