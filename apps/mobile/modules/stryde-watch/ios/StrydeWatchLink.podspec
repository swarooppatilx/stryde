Pod::Spec.new do |s|
  s.name           = 'StrydeWatchLink'
  s.version        = '1.0.0'
  s.summary        = 'Links a Stryde recording to the Stryde Apple Watch app.'
  s.description    = 'Starts the watch workout, receives its mirrored session and streams readings to JS.'
  s.author         = 'Stryde'
  s.homepage       = 'https://github.com/swarooppatilx/stryde'
  s.license        = 'MIT'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit', 'WatchConnectivity'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
