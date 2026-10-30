/* Simulaattori – miehistötilan puheyhteys (testiversio), 30.10.2026.
 *
 * Ääni kulkee selainten välillä suoraan (WebRTC), jokainen laite yhdistää jokaiseen muuhun (ruorimies, navigoija, kouluttaja: kolme yhteyttä).
 * Yhteyden avaus (SDP) kulkee miehistötilan kanavalla viestinä 'rtc' (miehisto.js), itse ääni ei kulje Supabasen kautta. Yhteyden muodostaa
 * aina pienemmän järjestysnumeron rooli (ruorimies → navigoija → kouluttaja), ja ICE-ehdokkaat lähetetään SDP:n mukana yhdellä viestillä.
 * ICE-palvelimet: /api/simu (Vercelin SIMU_ICE, esim. TURN) tai oletuksena julkinen STUN.
 *
 * Kouluttajalla on kolme tilaa: kuuntele (miehistö ei kuule kouluttajaa), puhu ja radio (VHF:n kaltainen kaistarajattu ääni ja kohina).
 * Puhu ja radio voi rajata vain navigoijalle. Ruorimiehellä ja navigoijalla on mikrofonin mykistys.
 *
 * Viesti: { t: 'rtc', d: { k: 'hei' | 'tarjous' | 'vastaus' | 'pois', to: rooli tai '*', s: lähettäjän istunto, ts: vastaanottajan istunto, sdp } } */
(function (root) {
  'use strict';
  var RANK = { helm: 0, nav: 1, koul: 2 };
  var NAMES = { helm: 'ruorimies', nav: 'navigoija', koul: 'kouluttaja' };
  var DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
  var GATHER_MS = 2500;      // ICE-ehdokkaiden keruun enimmäisaika ennen SDP:n lähetystä
  var HELLO_MS = 5000;       // 'hei' toistetaan, jotta myöhemmin liittyvä tai uudelleen ladattu laite löytää muut

  // opt: { role, send(t, d), ice: Promise<iceServers> (valinnainen), onChange() }
  function create(opt) {
    var role = opt.role, sid = Math.random().toString(36).slice(2, 10);
    var peers = {}, mic = null, ctx = null, radioTrack = null, noise = null, started = false, starting = null, helloT = null;
    var muted = false, mode = 'kuuntele', navOnly = false, err = '';
    var iceP = opt.ice || Promise.resolve(DEFAULT_ICE);

    function changed() { if (opt.onChange) try { opt.onChange(); } catch (e) {} }
    function send(d) { return opt.send('rtc', d); }

    // Mikrofoni avataan käyttäjän painalluksesta (iPhone vaatii eleen äänelle).
    function start() {
      if (starting) return starting;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof RTCPeerConnection === 'undefined') {
        err = 'Selain ei tue puheyhteyttä.'; changed(); return Promise.resolve(false);
      }
      starting = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (s) {
        mic = s; started = true; err = '';
        if (role === 'koul') buildRadio();
        applyTracks(); hello(); changed();
        return true;
      }, function (e) {
        starting = null; err = e && e.name === 'NotAllowedError' ? 'Mikrofonin käyttö estetty. Salli mikrofoni selaimen asetuksista.' : 'Mikrofonia ei saatu käyttöön.';
        changed(); return false;
      });
      return starting;
    }
    function stop() {
      clearTimeout(helloT); helloT = null;
      if (started) send({ k: 'pois', to: '*', s: sid });
      Object.keys(peers).forEach(closePeer);
      if (mic) mic.getTracks().forEach(function (t) { t.stop(); });
      if (ctx) try { ctx.close(); } catch (e) {}
      mic = ctx = radioTrack = noise = null; started = false; starting = null; changed();
    }
    function hello() {
      clearTimeout(helloT);
      if (!started) return;
      send({ k: 'hei', to: '*', s: sid });
      helloT = setTimeout(hello, HELLO_MS);
    }

    // Radioääni: kaistanrajaus 300–3000 Hz, kevyt särö ja taustakohina (kouluttajan radiotila)
    function buildRadio() {
      var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      var src = ctx.createMediaStreamSource(mic), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), sh = ctx.createWaveShaper(), out = ctx.createMediaStreamDestination();
      hp.type = 'highpass'; hp.frequency.value = 300; lp.type = 'lowpass'; lp.frequency.value = 3000;
      var n = 1024, curve = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); }
      sh.curve = curve;
      var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0); for (var j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
      noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      var nf = ctx.createBiquadFilter(), ng = ctx.createGain(); nf.type = 'bandpass'; nf.frequency.value = 1800; nf.Q.value = 0.6; ng.gain.value = 0.035;
      src.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(out);
      noise.connect(nf); nf.connect(ng); ng.connect(out); noise.start();
      radioTrack = out.stream.getAudioTracks()[0];
    }
    function resumeAudio() { if (ctx && ctx.state === 'suspended') try { ctx.resume(); } catch (e) {} }

    // Lähetettävä ääni vastaanottajan roolin mukaan
    function trackFor(to) {
      var m = mic ? mic.getAudioTracks()[0] : null;
      if (!m) return null;
      if (role !== 'koul') return muted ? null : m;
      if (mode === 'kuuntele' || (navOnly && to !== 'nav')) return null;
      return mode === 'radio' && radioTrack ? radioTrack : m;
    }
    function applyTracks() {
      Object.keys(peers).forEach(function (r) {
        var p = peers[r]; if (!p.tr) return;
        var t = trackFor(r);
        if (p.sent !== t) { p.sent = t; try { p.tr.sender.replaceTrack(t); } catch (e) {} }
      });
    }

    function newPeer(r, rsid) {
      closePeer(r);
      var ice = peers[r] = { pc: null, rsid: rsid, tr: null, sent: undefined, audio: null, state: 'yhdistetään', t: Date.now() };
      return iceP.then(function (servers) {
        if (peers[r] !== ice) return null;
        var pc = ice.pc = new RTCPeerConnection({ iceServers: servers || DEFAULT_ICE });
        pc.ontrack = function (e) {
          if (!ice.audio) { ice.audio = document.createElement('audio'); ice.audio.autoplay = true; ice.audio.setAttribute('playsinline', ''); ice.audio.className = 'puhe-audio'; ice.audio.hidden = true; document.body.appendChild(ice.audio); }
          ice.audio.srcObject = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
          var pl = ice.audio.play(); if (pl && pl.catch) pl.catch(function () {});
        };
        pc.onconnectionstatechange = function () {
          var s = pc.connectionState;
          ice.state = s === 'connected' ? 'yhdistetty' : s === 'failed' ? 'virhe' : s === 'disconnected' ? 'katkennut' : s === 'closed' ? 'suljettu' : 'yhdistetään';
          changed();
          if (s === 'failed' && peers[r] === ice) { closePeer(r); send({ k: 'hei', to: r, s: sid }); }   // uusi yritys: muodostaja aloittaa alusta
        };
        return ice;
      });
    }
    function closePeer(r) {
      var p = peers[r]; if (!p) return;
      delete peers[r];
      try { if (p.pc) p.pc.close(); } catch (e) {}
      if (p.audio) { try { p.audio.srcObject = null; } catch (e) {} if (p.audio.parentNode) p.audio.parentNode.removeChild(p.audio); }
      changed();
    }
    // SDP lähetetään, kun ICE-ehdokkaat on kerätty (tai GATHER_MS kuluttua)
    function gathered(pc) {
      return new Promise(function (res) {
        if (pc.iceGatheringState === 'complete') return res();
        var t = setTimeout(res, GATHER_MS);
        pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
      });
    }
    function offerTo(r, rsid) {
      newPeer(r, rsid).then(function (p) {
        if (!p) return;
        var pc = p.pc;
        p.tr = pc.addTransceiver('audio', { direction: 'sendrecv' }); p.sent = undefined; applyTracks();
        return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return gathered(pc); }).then(function () {
          if (peers[r] === p) send({ k: 'tarjous', to: r, s: sid, ts: rsid, sdp: pc.localDescription.sdp });
        });
      }).catch(function (e) { err = 'Puheyhteyden avaus epäonnistui.'; changed(); });
    }
    function answer(r, d) {
      newPeer(r, d.s).then(function (p) {
        if (!p) return;
        var pc = p.pc;
        return pc.setRemoteDescription({ type: 'offer', sdp: d.sdp }).then(function () {
          p.tr = pc.getTransceivers()[0]; if (p.tr) { p.tr.direction = 'sendrecv'; p.sent = undefined; applyTracks(); }
          return pc.createAnswer();
        }).then(function (a) { return pc.setLocalDescription(a); }).then(function () { return gathered(pc); }).then(function () {
          if (peers[r] === p) send({ k: 'vastaus', to: r, s: sid, ts: d.s, sdp: pc.localDescription.sdp });
        });
      }).catch(function () { err = 'Puheyhteyden avaus epäonnistui.'; changed(); });
    }

    // Miehistökanavan 'rtc'-viesti. from = lähettäjän rooli.
    function onSignal(from, d) {
      if (!started || !d || RANK[from] == null || from === role) return;
      if (d.to !== '*' && d.to !== role) return;
      var p = peers[from], iInit = RANK[role] < RANK[from];
      if (d.k === 'hei') {
        if (p && p.rsid === d.s && (p.state === 'yhdistetty' || p.state === 'katkennut' || (p.state === 'yhdistetään' && Date.now() - p.t < 15000))) return;   // sama yhteys on jo olemassa tai muodostumassa
        if (iInit) offerTo(from, d.s);
        else if (!p || p.rsid !== d.s) send({ k: 'hei', to: from, s: sid });              // muodostaja lähettää tarjouksen
      } else if (d.k === 'tarjous' && !iInit && d.ts === sid) answer(from, d);
      else if (d.k === 'vastaus' && iInit && d.ts === sid && p && p.rsid === d.s && p.pc) {
        p.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }).catch(function () {});
      } else if (d.k === 'pois' && p && p.rsid === d.s) closePeer(from);
    }

    function setMuted(v) { muted = !!v; applyTracks(); changed(); }
    function setMode(m, only) { mode = m === 'puhu' || m === 'radio' ? m : 'kuuntele'; if (only != null) navOnly = !!only; resumeAudio(); applyTracks(); changed(); }
    function status() {
      var o = {}; Object.keys(peers).forEach(function (r) { o[r] = peers[r].state; });
      return { started: started, muted: muted, mode: mode, navOnly: navOnly, err: err, peers: o };
    }

    // Siirretyt äänitavut yhteyksittäin (vianetsintä ja testit): { rooli: { sisaan, ulos } }
    function stats() {
      var out = {};
      return Promise.all(Object.keys(peers).map(function (r) {
        var p = peers[r]; if (!p.pc) return null;
        return p.pc.getStats().then(function (rep) {
          var o = { sisaan: 0, ulos: 0 };
          rep.forEach(function (x) { if (x.kind === 'audio' && x.type === 'inbound-rtp') o.sisaan += x.bytesReceived || 0; if (x.kind === 'audio' && x.type === 'outbound-rtp') o.ulos += x.bytesSent || 0; });
          out[r] = o;
        });
      })).then(function () { return out; });
    }

    if (typeof root.addEventListener === 'function') root.addEventListener('pagehide', function () { if (started) send({ k: 'pois', to: '*', s: sid }); });
    return { start: start, stop: stop, hello: hello, stats: stats, onSignal: onSignal, setMuted: setMuted, setMode: setMode, status: status, resumeAudio: resumeAudio, sid: sid };
  }

  root.Puhe = { create: create, NAMES: NAMES, DEFAULT_ICE: DEFAULT_ICE };
})(typeof window !== 'undefined' ? window : globalThis);
