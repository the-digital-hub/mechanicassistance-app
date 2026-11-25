Pod::Spec.new do |s|
  s.name           = 'ScreenRotation'
  s.version        = '1.0.0'
  s.summary        = 'Rotates the screen to portrait or landscape right now.'
  s.description    = 'Local Expo module: asks iOS to rotate the interface now, even when the phone is held sideways.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
