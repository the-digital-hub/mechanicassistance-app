Pod::Spec.new do |s|
  s.name           = 'AppBadge'
  s.version        = '1.0.0'
  s.summary        = 'Clears the app icon badge.'
  s.description    = 'Local Expo module: clears the app icon badge set by push notifications.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
