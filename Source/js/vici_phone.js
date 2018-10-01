/*
*******************************************************************************
*
*	JavaScript File for the Vicidial WebRTC Phone
*
*	Copyright (C) 2016  Michael Cargile
*	Version 1.0.0
*
*	This program is free software: you can redistribute it and/or modify
*	it under the terms of the GNU Affero General Public License as
*	published by the Free Software Foundation, either version 3 of the
*	License, or (at your option) any later version.
*
*	This program is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*	GNU Affero General Public License for more details.
*
*	You should have received a copy of the GNU Affero General Public License
*	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
*******************************************************************************
*/

var debug = debug_enabled;

// Array of the various UI elements
var uiElements = {
	container:		document.getElementById('container'),
	main:			document.getElementById('main'),
	audio:			document.getElementById('audio'),
	logo:			document.getElementById('logo'),
	controls:		document.getElementById('controls'),
	registration_control:	document.getElementById('registration_control'),
	reg_status:		document.getElementById('reg_status'),
	register:		document.getElementById('register'),
	unregister:		document.getElementById('unregister'),
	dial_control:	document.getElementById('dial_control'),
	digits:			document.getElementById('digits'),
	dial:			document.getElementById('dial'),
	audio_control:	document.getElementById('audio_control'),
	mic_mute:		document.getElementById('mic_mute'),
	vol_up:			document.getElementById('vol_up'),
	vol_down:		document.getElementById('vol_down'),
	dialpad:		document.getElementById('dialpad'),
	one:			document.getElementById('one'),
	two:			document.getElementById('two'),
	three:			document.getElementById('three'),
	four:			document.getElementById('four'),
	five:			document.getElementById('five'),
	six:			document.getElementById('six'),
	seven:			document.getElementById('seven'),
	eight:			document.getElementById('eight'),
	nine:			document.getElementById('nine'),
	star:			document.getElementById('star'),
	zero:			document.getElementById('zero'),
	pound:			document.getElementById('pound'),
	dial_dtmf:		document.getElementById('dial_dtmf'),
	dtmf_digits:	document.getElementById('dtmf_digits'),
	send_dtmf:		document.getElementById('send_dtmf'),
	debug:			document.getElementById('debug'),
	reg_icon:		document.getElementById('reg_icon'),
	unreg_icon:		document.getElementById('unreg_icon'),
	dial_icon:		document.getElementById('dial_icon'),
	hangup_icon:	document.getElementById('hangup_icon'),
	mute_icon:		document.getElementById('mute_icon'),
	vol_up_icon:	document.getElementById('vol_up_icon'),
	vol_down_icon:	document.getElementById('vol_down_icon')
}

var ua;
var my_session = false;
var incall = false;
var ringing = false;
var muted = false;
var caller = '';
var mediaStream;
var mediaConstraints;

var ua_config = {
	
	userAgentString: 'VICIphone 1.0-rc1',
	traceSip: true,
	register: true,
	hackIpInContact: true,
	hackWssInTransport: true,

	displayName: cid_name,
	uri: sip_uri,
	authorizationUser: auth_user,
	password: password,
	wsServers: ws_server,
	rtcpMuxPolicy: "negotiate"
	//rtcpMuxPolicy: 'require'
}

// We define initial status
uiElements.reg_status.value = get_translation('unregistered');

debug_out ( '<br />displayName: ' + cid_name + "<br />uri: " + sip_uri + "<br />authorizationUser: " + auth_user + "<br />password: " + password + "<br />wsServers: " + ws_server );

var sip_server = ua_config.uri.replace(/^.*@/,'');

// setup the ringing audio file
ringAudio = new Audio('sounds/ringing.mp3'); 
ringAudio.addEventListener('ended', function() {
	this.currentTime = 0;
	this.play();
}, false);

processDisplaySettings();

if ( !SIP.WebRTC.isSupported() ) {
	WebRTCError();
} else {
	initialize();
}



/************************************

  Beginning of functions 

*************************************/

function debug_out( string ) {
	// check if debug is enabled. If it isn't, end without doing anything
	if ( !debug ) 
		return false;
	
	// format the date string
	var date;
	date = new Date();
	date = date.getFullYear() + '-' +
		('00' + (date.getMonth()+1)).slice(-2) + '-' +
		('00' + date.getDate()).slice(-2) + ' ' +
		('00' + date.getHours()).slice(-2) + ':' +
		('00' + date.getMinutes()).slice(-2) + ':' +
		('00' + date.getSeconds()).slice(-2);

	// add the debug string to the debug element
	uiElements.debug.innerHTML = uiElements.debug.innerHTML + date + ' => ' + string + '<br>';
}

function startBlink( ) {
	uiElements.reg_status.style.backgroundImage = "url('images/reg_status_blink.gif')";
}

function stopBlink( ) {
	uiElements.reg_status.style.backgroundImage = "";
}

function dialPadPressed( digit, my_session ) {
	// only work if the dialpad is not hidden
	if ( hide_dialpad )
		return false;
	
	// check if the my_session is not there
	if ( my_session == false ) {
		debug_out( 'Adding key press ' + digit + ' to dial digits' );
		uiElements.digits.value = uiElements.digits.value + digit;
	} else {
		debug_out( 'Sending DTMF ' +  digit );
		my_session.dtmf( digit );
	}
}

function sendButton( my_session ) {
	// only work if the dialpad is not hidden
	if ( hide_dialpad )
		return false;
	
	// check if the my_session is not there
	if ( my_session == false ) {
		// TODO give some type of error
	} else {
		var digits = uiElements.dtmf_digits.value;
		debug_out( 'Sending DTMF ' +  digits );
		my_session.dtmf( digits );
		uiElements.dtmf_digits.value = '';
	}
}

function registerButton( ua ) {
	debug_out( 'Register Button Pressed' );
	ua.register();
}

function unregisterButton( ua ) {
	debug_out( 'Un-Register Button Pressed' );
	ua.unregister();
}

function dialButton() {
	// check if in a call
	if ( incall ) {
		// we are so they hung up the call
		debug_out( 'Hangup Button Pressed' );
		hangupCall();
		setCallButtonStatus(false);
	} else {
		// we are not
		setCallButtonStatus(true);
		
		// check if ringing
		if ( ringing ) {
			// we are ringing
			// stop the ringing
			ringing = false;
			stopBlink();
			ringAudio.pause();
			ringAudio.currentTime = 0;

			incall = true;
			debug_out( 'Answered Call' );

			var options = {
				media: {
					constraints: {
						audio: true,
						video: false
					},
					render: {
						remote: uiElements.audio
					},
					stream: mediaStream
				}
			}

			my_session.accept(options);

		} else {
			// not in a call and the phone is not ringing
			debug_out( 'Dial Button Pressed' );
			// made sure the dial box is not hidden
			if ( !hide_dialbox ) {
				dialNumber();
			}
		}
	}
}

function muteButton() {
	// only work if the button is not hidden
	if ( hide_mute )
		return false;

	// check if in a call
	if ( incall ) {
		if ( muted ) {
			// call is currently muted
			// unmute it
			muted = false;
			my_session.unmute();
			debug_out( 'Un-Mute Button Pressed' );
			uiElements.mute_icon.src = 'images/wp_mic_on.gif';
		} else {
			// call is not muted
			// mute it
			muted = true;
			my_session.mute();
			debug_out( 'Mute Button Pressed' );
			uiElements.mute_icon.src = 'images/wp_mic_off.gif';
		}
	} else {
		debug_out( 'Mute Button Pressed But Not In Call' );
		uiElements.mute_icon.src = 'images/wp_mic_on.gif';
		muted = false;
	}
}

function volumeUpButton() {
	// only work if the volume buttons are not hidden
	if ( hide_volume )
		return false;
	
	debug_out( 'Volume Up Button Pressed' );
	volume = uiElements.audio.volume;
	debug_out( 'Current Volume = ' + Math.round(volume * 100) + '%');
	if ( volume >= 1.0 ) {
		debug_out( 'Volume is maxed' );
	} else {
		volume = volume + 0.1;
	}
	if ( volume < 0 ) { volume = 0; }
	if ( volume > 1 ) { volume = 1; }
	debug_out( 'New Volume = ' + Math.round(volume * 100) + '%' );
	uiElements.audio.volume = volume;
}

function volumeDownButton() {
	// only work if the volume buttons are not hidden
	if ( hide_volume )
		return false;
	
	debug_out( 'Volume Down Button Pressed' );
	volume = uiElements.audio.volume;
	debug_out( 'Current Volume = ' + Math.round(volume * 100) + '%');
	if ( volume <= 0 ) {
		debug_out( 'Volume is already 0' );
	} else {
		volume = volume - 0.1;
	}
	if ( volume < 0 ) { volume = 0; }
	if ( volume > 1 ) { volume = 1; }
	debug_out( 'New Volume = ' + Math.round(volume * 100) + '%');
	uiElements.audio.volume = volume;
}

function hangupCall() {
	// check if in a call
	if ( !incall ) { 
		debug_out( 'Attempt to hang up non-existant call' );
		return false;
	}

	my_session.terminate();
	my_session = false;
	incall = false;
	ringAudio.pause();
	ringAudio.currentTime = 0;
	if ( ua.isRegistered() ) {
		setRegisterStatus('registered');
		setCallButtonStatus(false);
	} else {
		setRegisterStatus('unregistered');
		setCallButtonStatus(true);
	}				
}

function dialNumber() {
	// check if currently in a call
	if ( incall ) {
		debug_out( 'Already in a call' );
		return false;
	} 
	
	var uri = uiElements.digits.value + '@' + sip_server;
	var options = {
		media: {
			constraints: {
				audio: true,
				video: false
			},
			render: {
				remote: uiElements.audio
			},
			stream: mediaStream
		}
	};
	my_session = ua.invite( uri, options );
	incall = true;
	setRegisterStatus(get_translation('attempting') + ' - ' + uiElements.digits.value);
	setCallButtonStatus(true);

	caller = uiElements.digits.value;

	// assign event handlers to the session
	my_session.on('accepted', function() { handleAccepted() } );
	my_session.on('bye', function( request ) { handleBye( request ) } );
	my_session.on('failed', function( response, cause ) { handleFailed( response, cause ) } );
	my_session.on('refer', function() { handleInboundRefer() } );
	my_session.on('progress', function( progress ) { handleProgress( progress ) } );

	uiElements.digits.value = '';
}

function setCallButtonStatus( status ) {
	if ( status ) {
		uiElements.dial.setAttribute('class', 'button hangup');
		uiElements.dial_icon.src = 'images/wp_hangup.gif';		
	}
	else {
		uiElements.dial.setAttribute('class', 'button dial');
		uiElements.dial_icon.src = 'images/wp_dial.gif';		
	}
}

function handleProgress( progress ) {
	debug_out( 'Their end is ringing - ' + progress );

	setRegisterStatus(get_translation('ringing') + ' - ' + caller);

	// start ringing
	ringAudio.play();
	startBlink();
}


function handleInvite( session ) {
	my_session = session;

	// check if we are in a call already
	if ( incall ) {
		// we are so reject it
		debug_out( 'Recieved INVITE while in a call. Rejecting.' );
		var options = {
			statusCode: 486,
			reasonPhrase: "Busy Here"
		};
		my_session.reject(options);
	} else {
		// we are not so good to process it

		// add session event listeners
		my_session.on('accepted', function() { handleAccepted() } );
		my_session.on('bye', function( request ) { handleBye( request ) } );
		my_session.on('failed', function( response, cause ) { handleFailed( response, cause ) } );
		my_session.on('refer', function() { handleInboundRefer() } );

		var remoteUri = session.remoteIdentity.uri.toString();
		var displayName = session.remoteIdentity.displayName;
		var regEx1 = /sip:/;
		var regEx2 = /@.*$/;
		var extension = remoteUri.replace( regEx1 , '' );
		extension = extension.replace( regEx2 , '' );
		caller = extension;

		debug_out( 'Got Invite from <' + extension + '> "' + displayName + '"');
		uiElements.reg_status.value = extension + ' - ' + displayName;

		// if auto answer is set answer the call
		if ( auto_answer ) {
			incall = true;
			debug_out( 'Auto-Answered Call' );

			var options = {
				media: {
					constraints: {
						audio: true,
						video: false
					},
					render: {
						remote: uiElements.audio
					},
					stream: mediaStream
				}
			}
			my_session.accept(options);
			setCallButtonStatus(true);
		} else {
			// auto answer not enabled 
			// ring the phone
			ringing = true;
	
			// start ringing
			ringAudio.play();
			startBlink();
		}
	}
}

function handleAccepted() {
	debug_out( 'Session Accepted Event Fired' );

	uiElements.reg_status.value = get_translation('incall') + ' - ' + caller;

	// They answered stop ringing
	ringAudio.pause();
	ringAudio.currentTime = 0;
	stopBlink();
}

function handleBye( request ) {
	debug_out( 'Session Bye Event Fired |' + request  );
	if ( ua.isRegistered() ) {
		setRegisterStatus( 'registered' );
	} else {
		setRegisterStatus( 'unregistered' );
	}
	setCallButtonStatus(false);
	my_session = false;
	incall = false;
}

function handleFailed( response, cause ) {
	debug_out( 'Session Failed Event Fired | ' + response + ' | ' + cause );
	// stop ringing
	ringing = false;
	stopBlink();
	ringAudio.pause();
	ringAudio.currentTime = 0;
	// check if we are registered and adjust the display accordingly
	if ( ua.isRegistered() ) {
		setRegisterStatus( 'registered' );
	} else {
		setRegisterStatus( 'unregistered' );
	}
	my_session = false;
	if ( cause == 'Canceled' ) { }
	else if (( cause == 'WebRTC Error' ) || ( cause == 'WebRTC not supported') || ( cause == 'WebRTC not supported' )) {
		WebRTCError();
	}
	setCallButtonStatus(false);
	my_session = false;
	incall = false;
	return;
}

function setRegisterStatus( message ) {
	if ( (message == 'registered') || (message == 'connected') ) {
		uiElements.reg_icon.src = 'images/wp_register_active.gif';
		uiElements.unreg_icon.src = 'images/wp_unregister_inactive.gif';	
		translated_message = get_translation(message)
	}
	else if ( (message == 'unregistered') || (message == 'disconnected') || (message == 'register_failed') ) {
		uiElements.reg_icon.src = 'images/wp_register_inactive.gif';
		uiElements.unreg_icon.src = 'images/wp_unregister_active.gif';
		translated_message = get_translation(message)
	}
	else {
		translated_message = message;
	}
	
	if (uiElements.reg_status.type == 'text')
		uiElements.reg_status.value = translated_message;	
	else
		uiElements.reg_status.innerHTML = translated_message;
}

function handleInboundRefer() {
	debug_out( 'Session Refer Event Fired' );
}

function WebRTCError() {
	alert( get_translation('webrtc_error'));
}

function initialize() {
	// Initialization
	// Dial pad keys 
	uiElements.one.addEventListener("click", function() { dialPadPressed('1',my_session) } );
	uiElements.two.addEventListener("click", function() { dialPadPressed('2',my_session) } );
	uiElements.three.addEventListener("click", function() { dialPadPressed('3',my_session) } );
	uiElements.four.addEventListener("click", function() { dialPadPressed('4',my_session) } );
	uiElements.five.addEventListener("click", function() { dialPadPressed('5',my_session) } );
	uiElements.six.addEventListener("click", function() { dialPadPressed('6',my_session) } );
	uiElements.seven.addEventListener("click", function() { dialPadPressed('7',my_session) } );
	uiElements.eight.addEventListener("click", function() { dialPadPressed('8',my_session) } );
	uiElements.nine.addEventListener("click", function() { dialPadPressed('9',my_session) } );
	uiElements.zero.addEventListener("click", function() { dialPadPressed('0',my_session) } );
	uiElements.star.addEventListener("click", function() { dialPadPressed('*',my_session) } );
	uiElements.pound.addEventListener("click", function() { dialPadPressed('#',my_session) } );
	
	// Send DTMF button
	uiElements.send_dtmf.addEventListener("click", function() { sendButton(my_session) } );
	
	// Dial Button
	uiElements.dial.addEventListener("click", function() { dialButton() } );
	
	// Mute	 Button
	uiElements.mic_mute.addEventListener("click", function() { muteButton() } );

	// Volume Buttons
	uiElements.vol_up.addEventListener("click", function() { volumeUpButton() } );
	uiElements.vol_down.addEventListener("click", function() { volumeDownButton() } );

	// Register Button
	uiElements.register.addEventListener("click", function() { registerButton( ua ) } );
	
	// Unregister Button
	uiElements.unregister.addEventListener("click", function() { unregisterButton( ua ) } );

	// Change text language for some elements
	uiElements.send_dtmf.innerHTML = get_translation('send');
	uiElements.reg_status.value = get_translation('connecting');

	// create the User Agent
	ua = new SIP.UA(ua_config);

	// assign event handlers
	ua.on('connected', function () {
		setRegisterStatus('connected');
	});
	
	ua.on('registered', function () {
		setRegisterStatus( 'registered' );
		
		// If auto dial out is enabled and a dial_number is given, do the auto dialing
		if ( (auto_dial_out) && (uiElements.digits.value.length > 0) ) {
			dialButton();
		}
	});

	ua.on('unregistered', function () {
		setRegisterStatus( 'unregistered' );
	});

	ua.on('disconnected', function () {
		setRegisterStatus('disconnected');
	});

	ua.on('registrationFailed', function () {
		setRegisterStatus('register_failed');
	});

	ua.on('invite', function (session) {
		handleInvite( session );
	});

	// get a media stream so users are not constantly prompted
	mediaConstraints = {
		audio: true,
		video: false
	};
	SIP.WebRTC.isSupported();
	SIP.WebRTC.getUserMedia(mediaConstraints, getUserMediaSuccess, getUserMediaFailure);
};

function getUserMediaSuccess (stream) {
	console.log('getUserMedia succeeded', stream)
	mediaStream = stream;
}

function getUserMediaFailure (e) {
	console.error('getUserMedia failed:', e);
}

function processDisplaySettings() {
	if ( hide_dialpad ) {
		uiElements.dialpad.setAttribute("hidden", true);
	}
	if ( hide_dialbox ) {
		uiElements.digits.setAttribute("hidden", true);
	}
	if ( hide_mute ) {
		uiElements.mic_mute.setAttribute("hidden", true);
	}
	if ( hide_volume ) {
		uiElements.vol_down.setAttribute("hidden", true);
		uiElements.vol_up.setAttribute("hidden", true);
	}
}


/*
	Hardcoded messages. Can be translated by loading translations.js
*/
function get_translation(text) {
	// Default language. This can be overriden by defining the 'language' variable before loading this file
	if ( ( typeof language == 'undefined' ) || ( language.length == 0) )
		language = 'en';
	
	if ( typeof vici_translations == 'undefined' ) {
		vici_translations = {
			en: {
				registered: 	'Registered',
				unregistered:	'Unregistered',
				connecting: 	'Connecting...',
				disconnected: 	'Disconnected',
				connected: 		'Connected',
				register_failed:'Reg. failed',
				incall: 		'Incall',
				ringing: 		'Ringing',
				attempting: 	'Attempting',
				send: 			'Send',
				webrtc_error:	'Something went wrong with WebRTC. Either your browser does not support the necessary WebRTC functions, you did not allow your browser to access the microphone, or there is a configuration issue. Please check your browsers error console for more details. For a list of compatible browsers please vist http://webrtc.org/',
			}
		}
	}
	// If selected language doesn't exist, fallback to english
	if ( typeof vici_translations[language] == 'undefined' )
		vici_translations[language] = vici_translations['en'];

	return vici_translations[language][text];
}
