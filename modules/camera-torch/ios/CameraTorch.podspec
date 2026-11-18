Pod::Spec.new do |s|
  s.name           = 'CameraTorch'
  s.version        = '1.0.0'
  s.summary        = 'Turns the rear camera flashlight on and off.'
  s.description    = 'Local Expo module: the flashlight of the rear camera, usable while a video call is using the camera.'
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
