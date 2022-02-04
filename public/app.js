function fail (str) {
  alert(str + '\nUnable to access the camera Please ensure you are on HTTPS and using Firefox or Chrome.')
}

const outputConsole = document.getElementById('outputConsole')
const outputMessage = document.getElementById('outputMessage')
const outputVideo = document.getElementById('outputVideo')
const buttonStart = document.getElementById('buttonStart')
const buttonStop = document.getElementById('buttonStop')
const buttonServer = document.getElementById('buttonServer')
const recordingCircle = document.getElementById('recordingCircle')
// const socketioAddress = '/' // For same server
const socketioAddress = 'ws://localhost:3000/'
const height = 240
const width = 240
const framerate = 15
const audiobitrate = 22050 || 44100 || 11025
const url = `rtmp://${location.host.split(':')[0]}:1935/a`

buttonStart.onclick = requestMedia
buttonStop.onclick = stopStream
buttonServer.onclick = connectServer

const oo = document.getElementById('checkboxReconnection')
let mediaRecorder
let socket
let state = 'stop'
let t
buttonStart.disabled = true
buttonStop.disabled = true

function videoShow (stream) {
  if ('srcObject' in outputVideo) {
    outputVideo.muted = true
    outputVideo.srcObject = stream
  } else {
    outputVideo.src = window.URL.createObjectURL(stream)
  }
  outputVideo.addEventListener('loadedmetadata', function (e) {
    // console.log(outputVideo);
    outputMessage.innerHTML = 'Local video source size:' + outputVideo.videoWidth + 'x' + outputVideo.videoHeight
  }, false)
}

function showOutput (str) {
  outputConsole.value += '\n' + str
  outputConsole.scrollTop = outputConsole.scrollHeight
};

function timedCount () {
  if (oo.checked) {
    console.log('timed count state = ' + state)
    if (state === 'ready') {
      console.log('reconnecting and restarting the media stream')
      // do I need to rerun the request media?

      connectServer()
      buttonStart.disabled = false
      buttonServer.disabled = true
    } else {
      console.log('not ready yet - wating 1000ms')
      t = setTimeout(timedCount(), 1000)
      connectServer()
      outputMessage.innerHTML = 'try connect server ...'
      buttonStart.disabled = true
      buttonServer.disabled = false
    }
  } else {
    console.log('reconnection is off, buttons hcnage and we are done.')
    buttonStart.disabled = true
    buttonServer.disabled = false
  }
}

function connectServer () {
  navigator.getUserMedia = (navigator.mediaDevices.getUserMedia ||
        navigator.mediaDevices.mozGetUserMedia ||
        navigator.mediaDevices.msGetUserMedia ||
        navigator.mediaDevices.webkitGetUserMedia)
  if (!navigator.getUserMedia) { fail('No getUserMedia() available.') }
  if (!MediaRecorder) { fail('No MediaRecorder available.') }

  const socketOptions = {
    secure: true,
    reconnection: true,
    reconnectionDelay: 1000,
    timeout: 15000,
    pingTimeout: 15000,
    pingInterval: 45000,
    query: {
      framespersecond: framerate,
      audioBitrate: audiobitrate
    }
  }

  socket = io.connect(socketioAddress, socketOptions)

  socket.on('connect_timeout', (timeout) => {
    console.log('state on connection timeout= ' + timeout)
    outputMessage.innerHTML = 'Connection timed out'
    recordingCircle.style.fill = 'gray'
  })

  socket.on('error', (error) => {
    console.log('state on connection error= ' + error)
    outputMessage.innerHTML = 'Connection error'
    recordingCircle.style.fill = 'gray'
  })

  socket.on('connect_error', function () {
    console.log('state on connection error= ' + state)
    outputMessage.innerHTML = 'Connection Failed'
    recordingCircle.style.fill = 'gray'
  })

  socket.on('message', function (m) {
    console.log('state on message= ' + state)
    console.log('recv server message', m)
    showOutput('SERVER:' + m)
  })

  socket.on('fatal', function (m) {
    showOutput('Fatal ERROR: unexpected:' + m)
    // alert('Error:'+m);
    console.log('fatal socket error!!', m)
    console.log('state on fatal error= ' + state)
    console.log('media recorder restarted')
    recordingCircle.style.fill = 'gray'

    if (oo.checked) {
      outputMessage.innerHTML = 'server is reload!'
      console.log('server is reloading!')
      recordingCircle.style.fill = 'gray'
    }
  })

  socket.on('ffmpeg_stderr', function (m) {
    showOutput('FFMPEG:' + m)
  })

  socket.on('disconnect', function (reason) {
    console.log('state disconec= ' + state)
    showOutput('ERROR: server disconnected!')
    console.log('ERROR: server disconnected!' + reason)
    recordingCircle.style.fill = 'gray'
    connectServer()

    if (oo.checked) {
      outputMessage.innerHTML = 'server is reloading!'
      console.log('server is reloading!')
    }
  })

  state = 'ready'
  console.log('state = ' + state)
  buttonStart.disabled = false
  buttonStop.disabled = false
  buttonServer.disabled = true
  outputMessage.innerHTML = 'connect server successful'
}

function requestMedia () {
  const constraints = {
    audio: {
      sampleRate: audiobitrate,
      echoCancellation: true
    },
    video: {
      width: { min: 100, ideal: width, max: 1920 },
      height: { min: 100, ideal: height, max: 1080 },
      frameRate: { ideal: framerate }
    }
  }
  navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
      videoShow(stream) // only show locally, not remotely
      recordingCircle.style.fill = 'red'
      socket.emit('config_rtmpDestination', url)
      socket.emit('start', 'start')
      mediaRecorder = new MediaRecorder(stream)
      mediaRecorder.start(250)
      buttonStop.disabled = false
      buttonStart.disabled = true
      buttonServer.disabled = true

      mediaRecorder.onstop = function (e) {
        console.log('stopped!')
        console.log(e)
      }

      mediaRecorder.onpause = function (e) {
        console.log('media recorder paused!!')
        console.log(e)
      }

      mediaRecorder.onerror = function (event) {
        const error = event.error
        console.log('error', error.name)
      }

      mediaRecorder.ondataavailable = function (e) {
        console.log(e.data)
        socket.emit('binarystream', e.data)
        state = 'start'
      }
    })
    .catch(function (err) {
      console.log('The following error occured: ' + err)
      showOutput('Local getUserMedia ERROR:' + err)
      outputMessage.innerHTML = 'Local video source size is not support or No camera?' + outputVideo.videoWidth + 'x' + outputVideo.videoHeight
      state = 'stop'
      buttonStart.disabled = true
      buttonServer.disabled = false
    })
}

function stopStream () {
  console.log('stop pressed:')
  // stream.getTracks().forEach(track => track.stop())
  mediaRecorder.stop()
  recordingCircle.style.fill = 'gray'
  buttonStop.disabled = true
  buttonStart.disabled = true
  buttonServer.disabled = false
}
