Pod::Spec.new do |s|
  s.name           = 'VinText'
  s.version        = '1.0.0'
  s.summary        = 'Reads printed text from a photo.'
  s.description    = 'Local Expo module: on-device text recognition (Apple Vision) used to read the VIN printed on the door label or the windshield.'
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
