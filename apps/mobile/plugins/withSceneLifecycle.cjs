// Adopts the UIScene lifecycle on iOS. Recent iOS versions terminate apps at launch that
// don't, and the AppDelegate Expo generates still creates its window the old way.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const WINDOW_SETUP =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\s*#endif\n/;

const SCENE_DELEGATE = `
// Scene lifecycle: iOS terminates apps at launch that don't adopt it.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    // Show something at once and start React Native on the next turn of the run loop: in a
    // debug build finding the bundle can wait on the network for Metro, and iOS kills an app
    // whose scene takes more than a few seconds to connect.
    let placeholder = UIViewController()
    placeholder.view.backgroundColor = .systemBackground
    window.rootViewController = placeholder
    window.makeKeyAndVisible()
    let url = connectionOptions.urlContexts.first?.url
    let activity = connectionOptions.userActivities.first
    DispatchQueue.main.async {
      appDelegate.reactNativeFactory?.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: appDelegate.launchOptions)
      if let url {
        _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
      }
      if let activity {
        _ = appDelegate.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
      }
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    const { modResults } = cfg;
    if (modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = modResults.contents;
    if (src.includes('class SceneDelegate')) return cfg;

    if (!WINDOW_SETUP.test(src)) {
      throw new Error('withSceneLifecycle: AppDelegate window setup not found; update the plugin');
    }
    src = src.replace(
      WINDOW_SETUP,
      '    // SceneDelegate creates the window.\n    self.launchOptions = launchOptions\n'
    );
    src = src.replace(
      'var reactNativeFactory: RCTReactNativeFactory?\n',
      'var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n'
    );
    modResults.contents = src + SCENE_DELEGATE;
    return cfg;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

module.exports = (config) => withSceneManifest(withSceneAppDelegate(config));
