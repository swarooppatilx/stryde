import ExpoModulesCore

/// Registers for mirrored workouts at launch, before JavaScript loads.
public class StrydeWatchAppDelegate: BaseExpoAppDelegateSubscriber, ExpoAppDelegateSubscriberProtocol {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    WatchBridge.shared.install()
    return true
  }
}
