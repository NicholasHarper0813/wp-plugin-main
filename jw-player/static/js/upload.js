function JWPlayerUpload( link, resumableSession, redirect, id )
{
	this._resumable = ! ! resumableSession;
	if( this._resumable && ! JWPlayerUpload.resumeSupported() )
	{
		this._log( "Resumable uploads are not supported!" );
	}

	this._redirect = redirect;
	this._url = '//' + link.address + link.path
	+ '?api_format=json&key=' + link.query.key;

	// Add the upload token or set the session id
	if( ! this._resumable )
	{
		this._url += '&token=' + link.query.token;
	}
	else
	{
		this._sessionId = resumableSession;
	}

	this._redirectableUrl = this._url;
	if( redirect )
	{
		this._redirectableUrl += '&redirect_address=' + encodeURI( redirect.url );
		if( redirect.params )
		{
			for( p in redirect.params )
			{
				this._redirectableUrl += '&redirect_query.' + encodeURI( p ) + '=' + encodeURI( redirect.params[p] );
			}
		}
	}

	if( redirect )
	{
		this._redirectUrl = redirect.url;
		var c = 0;
		if( redirect.params )
		{
			for( var p in redirect.params ){
				this._redirectUrl += (c ++ === 0) ? '?' : '&';
				this._redirectUrl += p + '=' + redirect.params[p];
			}
		}
	}

	if( ! id )
	{
		id = this._generateAlphaUid();
	}
	this._id = id;

	if( ! this._resumable )
	{
		this._progressUrl = '//' + link.address + '/progress?token=' + link.query.token + '&callback=' + id + '_poll';
	}
}

JWPlayerUpload.prototype = {
	constructor:JWPlayerUpload,
	_submitted:false,
	_running:false,
	_completed:false,
	chunkSize:1024 * 1024 * 2,
	pollInterval:500,
	UID_LENGTH:32,
	isResumable:function()
	{
		return this._resumable;
	},
	onSelected:function(){
		this._log( "File was selected." );
	},
	onStart:function(){
		this._log( "Started upload." );
	},
	onProgress:function( bytes, total ){
		this._log( "Uploaded " + bytes + " bytes of " + total );
	},
	onCompleted:function( size, redirect ){
		this._log( "Finished uploading " + size + " bytes." );
		if( redirect ){
			this._log( "Redirecting to " + redirect + "." );
			document.location.href = redirect;
		}
	},
	onError:function( msg )
	{
		this._log( msg );
	},
	start:function()
	{
		if( this._completed ){
			this._log( "Attempting to start an upload which has already finished." );
			return;
		}
		if( this._form ){
			// Do nothing if we are already running.
			if( this._running ){
				return;
			}
			this._running = true;
			// Fire the start event
			this.onStart();
			if( this._resumable ){
				// Start reading the file and upload piece by piece.
				this._file = this._input.files[0];
				this._fileName = 'wordpress-upload.' + this._file.name.split('.').reverse()[0];
				this._currentChunk = 0;
				this._uploadChunk();
			}
			else{
				// Simply submit the form and start polling for progress.
				this._form.submit();
				this._submitted = true;
				this._poll();
			}
		}
	},
	pause:function(){
		if( ! this._resumable ){
			this._log( "Attempting to pause a non-resumable upload." );
			return;
		}
		this._running = false;
	},
	cancel:function()
	{
		if( ! this._resumable )
		{
			var ifr = this._iframe;
			if( ifr ){
				if( typeof(ifr.stop) !== 'undefined' )
				{
					ifr.stop();
				}
				else
				{
					ifr.src = 'about:blank';
				}
			}
			else
			{
				if( typeof(window.stop) !== 'undefined' )
				{
					window.stop();
				}
				else if( typeof(document.execCommand) !== 'undefined' )
				{
					document.execCommand( 'Stop' );
				}
			}
		}
		this._running = false;
	},

	getIframe:function()
	{
		if( ! this._iframe )
		{
			var ifr;
			{
				ifr = document.createElement('iframe');
				ifr.id = this._id;
			}
			this._iframe = ifr;
			ifr.style.display = 'none';

			this._attachEvent( ifr, 'load', function(){
				if( ! this._submitted || this._completed || ! this.running ){
					// Empty iframe has loaded
				}
				else{
					// We have sent the complete file.
					// Unfortunately, we can not read the response because of
					// cross origin browser restrictions, so let the poller take
					// care of the upload status.
					this._running = false;
					this._completed = true;
					this._iframe.parentNode.removeChild( this._iframe );
				}
			}, this );
			this.getForm().setAttribute( 'target', ifr.name );
			// Redirect the iframe to a blank page after the request is done.
			// This way, we prevent the JS "Download" dialog.
			this.getForm().setAttribute( 'action', this._url + '&redirect_address=about:blank' );
		}
		return this._iframe;
	},
	
	getForm:function(){
		if( ! this._form ){
			var f, i;
			{
				var div = document.createElement( 'div' );
				div.innerHTML = '<form method="post" enctype="multipart/form-data">';
				f = div.firstChild;
				div.removeChild( f );
				div.innerHTML = '<input type="file" name="file">';
				i = div.firstChild;
				div.removeChild( i );
			}
			f.appendChild( i );
			this.useForm( i );
		}
		return this._form;
	},

	useForm:function( element )
	{
		if( this._form ){
			this._log( "Already using a form." );
			return false;
		}
		if( element.tagName.toUpperCase() !== 'INPUT'
			|| element.getAttribute( 'type' ) !== 'file' ){
			this._log( "Invalid element." );
			return false;
		}
		var f = element.form;
		if( ! f ){
			// Konqueror does not understand element.form
			do{
				if( element.parentNode.tagName.toUpperCase() === 'FORM' ){
					f = element.parentNode;
				}
			}
			while( f );
		}
		if( ! f ){
			this._log( "Element is not part of a form." );
			return false;
		}
		// Change the parameters of the form for correct submission.
		f.setAttribute( 'action', this._redirectableUrl );
		f.setAttribute( 'method', 'post' );
		f.setAttribute( 'enctype', 'multipart/form-data' );
		element.setAttribute( 'name', 'file' );
		this._form = f;
		this._input = element;
		this._attachEvent( element, 'change', this.onSelected, this );
		this._attachEvent( f, 'submit', function(){
			this.start();
			return false;
		}, this );
	},

	_log:function( msg ){
		if( jwplayerwp.debug && typeof(console) !== 'undefined' ){
			if( console.log ){
				console.log( msg );
			}
		}
	},

	_attachEvent:function( element, event, callback, self )
	{
		var cb = callback;
		if( self ){
			cb = function(){
				callback.call( self );
			};
		}
		if( element.addEventListener ){
			element.addEventListener( event, cb, false );
		}
		else if( element.attachEvent ){
			element.attachEvent( 'on' + event, cb );
		}
	},

	_poll:function( data ){
		// Remove the previous JSON-P script tag if it exists.
		if( this._pollElt ){
			this._pollElt.parentNode.removeChild( this._pollElt );
			this._pollElt = undefined;
		}

		if( data ){
			var done = false;
			switch(data.state){
				case 'starting':
					break;
				case 'uploading':
					this._size = parseInt( data.size );
					this.onProgress( data.received, data.size );
					break;
				case 'done':
					this._completed = done = true;
					this._running = false;
					this.onCompleted( this._size, this._redirectUrl );
					break;
				case 'error':
					done = true;
					this.onError( "Error occurred with code " + data.status );
					break;
				default:
					done = true;
					this.onError( "Unknown error occurred." );
			}
			if( ! done && this._running )
			{
				var self = this;
				setTimeout( function(){
					self._poll.call( self );
				}, this.pollInterval );
			}
			else
			{
				// If we are finished, remove the JSON-P callback function.
				window[this._id + '_poll'] = undefined;
			}
		}
		else
		{
			var elt = this._pollElt = document.createElement( 'script' );
			elt.setAttribute( 'src', this._progressUrl + '&nocache=' + Math.random() );
			var self = this;
			window[this._id + '_poll'] = function( data )
			{
				self._poll.call( self, data );
			};
			var head = document.head || document.getElementsByTagName( 'head' )[0];
			head.appendChild( elt );
		}
	},

	_uploadChunk:function()
	{
		var start = this._currentChunk * this.chunkSize;
		var size = this._file.size;
		var end = Math.min( (this._currentChunk + 1) * this.chunkSize, size );
		var xhr = new XMLHttpRequest();
		var self = this;
		xhr.open( 'POST', this._url );
		xhr.setRequestHeader( 'Content-Disposition', 'attachment; filename="' + this._fileName + '"' );
		xhr.setRequestHeader( 'Content-Type', 'application/octet-stream' );
		xhr.setRequestHeader( 'X-Content-Range', 'bytes ' + start + '-' + (end - 1) + '/' + size );
		xhr.setRequestHeader( 'X-Session-ID', this._sessionId );
		xhr.onreadystatechange = function()
		{
			if( xhr.readyState === 4 )
			{
				if( xhr.status === 200 )
				{
					var response = JSON.parse(xhr.responseText)
					self._running = false;
					self._completed = true;
					self.onCompleted( parseInt( response.file.size ), self._redirectUrl );
				}
				else if( xhr.status === 201 )
				{
					var m = xhr.responseText.trim().match( /^(\d+)-(\d+)\/(\d+)$/ );
					if( ! m )
					{
						self.onError( "Received invalid response from the server." );
						return;
					}
					self._currentChunk = Math.floor( (parseInt( m[2] ) + 1) / self.chunkSize );
					self.onProgress( parseInt( m[2] ), parseInt( m[3] ) );
					if( self._running )
					{
						self._uploadChunk();
					}
				}
				else
				{
					self.onError( "Error response: " + xhr.statusText );
					return;
				}
			}
		};
		var f;
		if( this._file.mozSlice ){
			f = this._file.mozSlice;
		}
		else if( this._file.webkitSlice ){
			f = this._file.webkitSlice;
		}
		else{
			f = this._file.slice;
		}
		xhr.send( f.call( this._file, start, end, 'application/octet-stream' ) );
	},

	_generateAlphaUid:function()
	{
		var res = '';
		for( var i = 0; i < this.UID_LENGTH; ++ i ){
			var rand = Math.floor( Math.random() * 52 );
			// 0x41 == 'A', 0x61 == 'a'
			if( rand > 25 ){
				rand += 0x20 - 26;
			}
			rand += 0x41;
			res += String.fromCharCode( rand );
		}
		return res;
	}
}

JWPlayerUpload.resumeSupported = function()
{
	return (
	(typeof(File) !== 'undefined') &&
	(typeof(Blob) !== 'undefined') &&
	(typeof(FileList) !== 'undefined') &&
	( ! ! Blob.prototype.webkitSlice || ! ! Blob.prototype.mozSlice || ! ! Blob.prototype.slice)
	);
}
