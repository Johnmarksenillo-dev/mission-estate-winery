import { Component } from '@theme/component';
import { ThemeEvents, MediaStartedPlayingEvent } from '@theme/events';
import { DialogCloseEvent } from '@theme/dialog';

/**
 * A deferred media element
 * @typedef {Object} Refs
 * @property {HTMLElement} deferredMediaPlayButton - The button to show the deferred media content
 * @property {HTMLElement} toggleMediaButton - The button to toggle the media (play/pause)
 * @property {HTMLElement} [toggleMuteButton] - Optional: button to toggle mute/unmute
 *
 * @extends {Component<Refs>}
 */
class DeferredMedia extends Component {
  /** @type {boolean} */
  isPlaying = false;

  static MUTE_KEY = 'deferredMedia:muted'; // persisted site-wide

  #abortController = new AbortController();

  connectedCallback() {
    super.connectedCallback();
    const signal = this.#abortController.signal;
    document.addEventListener(
      ThemeEvents.mediaStartedPlaying,
      this.pauseMedia.bind(this),
      { signal }
    );
    window.addEventListener(
      DialogCloseEvent.eventName,
      this.pauseMedia.bind(this),
      { signal }
    );

    // Wire mute toggle (works even before content is revealed)
    this.refs.toggleMuteButton?.addEventListener(
      'click',
      () => this.toggleMute(),
      { signal }
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController.abort();
  }

  /** Utilities */
  /** @returns {HTMLVideoElement|null} */
  getVideoEl() {
    return this.querySelector('video');
  }
  /** @returns {HTMLIFrameElement|null} */
  getIframeEl() {
    return this.querySelector('iframe[data-video-type]');
  }
  /** Only apply state classes for hosted video (HTML5), not external iframes */
  isHostedVideo() {
    return !!this.getVideoEl() && !this.getIframeEl();
  }
  /** @param {'playing'|'paused'|'ended'} state */
  updateStateClasses(state) {
    if (!this.isHostedVideo()) return;
    this.classList.toggle('playing', state === 'playing');
    this.classList.toggle('paused', state === 'paused');
    if (state === 'ended') {
      this.classList.remove('playing', 'paused');
    }
  }

  /** Persisted mute */
  getStoredMuted() {
    try {
      return localStorage.getItem(DeferredMedia.MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }
  setStoredMuted(mut) {
    try {
      localStorage.setItem(DeferredMedia.MUTE_KEY, mut ? '1' : '0');
    } catch {}
  }
  applyMuteUI(mut) {
    const btn = this.refs.toggleMuteButton;
    if (!btn) return;
    const mutedIcon = btn.querySelector('.icon-muted');
    const unmutedIcon = btn.querySelector('.icon-unmuted');
    if (mutedIcon) mutedIcon.classList.toggle('hidden', !mut);
    if (unmutedIcon) unmutedIcon.classList.toggle('hidden', mut);
    btn.setAttribute('aria-pressed', String(mut));
  }
  toggleMute() {
    const video = this.getVideoEl();
    const next = !(video?.muted ?? this.getStoredMuted());
    if (video) video.muted = next;
    this.setStoredMuted(next);
    this.applyMuteUI(next);
  }

  /**
   * Updates the visual hint for play/pause state
   * @param {boolean} isPlaying - Whether the video is currently playing
   */
  updatePlayPauseHint(isPlaying) {
    const toggleMediaButton = this.refs.toggleMediaButton;
    if (toggleMediaButton instanceof HTMLElement) {
      toggleMediaButton.classList.remove('hidden');
      const playIcon = toggleMediaButton.querySelector('.icon-play');
      if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
      const pauseIcon = toggleMediaButton.querySelector('.icon-pause');
      if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);
      toggleMediaButton.setAttribute('aria-pressed', String(isPlaying));
    }
  }

  /**
   * Shows the deferred media content
   */
  showDeferredMedia = () => {
    this.loadContent(true);
    this.playMedia();
  };

  /**
   * Loads the content
   * @param {boolean} [focus] - Whether to focus the content
   */
  loadContent(focus = true) {
    if (this.getAttribute('data-media-loaded')) return;

    this.dispatchEvent(new MediaStartedPlayingEvent(this));

    const content =
      this.querySelector('template')?.content.firstElementChild?.cloneNode(
        true
      );
    if (!content) return;

    this.setAttribute('data-media-loaded', 'true');
    this.appendChild(content);

    if (focus && content instanceof HTMLElement) content.focus();

    this.refs.deferredMediaPlayButton?.classList.add('deferred-media__playing');

    // If video, wire events + apply persisted mute before autoplay
    const video = this.getVideoEl();
    if (video) {
      // Apply persisted mute (helps Safari autoplay)
      const persistedMuted = this.getStoredMuted();
      video.muted = persistedMuted;
      this.applyMuteUI(persistedMuted);

      // Wire state listeners (hosted video only)
      video.addEventListener('play', () => {
        this.isPlaying = true;
        this.updatePlayPauseHint(true);
        this.updateStateClasses('playing');
      });
      video.addEventListener('pause', () => {
        // 'pause' also fires at end; guard below in 'ended'
        if (!video.ended) {
          this.isPlaying = false;
          this.updatePlayPauseHint(false);
          this.updateStateClasses('paused');
        }
      });
      video.addEventListener('ended', () => {
        this.isPlaying = false;
        this.updatePlayPauseHint(false);
        this.updateStateClasses('ended');
      });

      // Respect autoplay attribute (force for Safari)
      if (video.getAttribute('autoplay') !== null) {
        // play() may reject on some browsers; ignore errors
        Promise.resolve(video.play()).catch(() => {});
      }
    }

    // If iframe external provider, we still update icons but we DO NOT add state classes
    const iframe = this.getIframeEl();
    if (
      iframe &&
      content instanceof HTMLElement &&
      content.getAttribute('autoplay') !== null
    ) {
      iframe.contentWindow?.postMessage(
        iframe.dataset.videoType === 'youtube'
          ? '{"event":"command","func":"playVideo","args":""}'
          : '{"method":"play"}',
        '*'
      );
    }
  }

  /**
   * Toggle play/pause state of the media
   */
  toggleMedia() {
    if (this.isPlaying) {
      this.pauseMedia();
    } else {
      this.playMedia();
    }
  }

  playMedia() {
    const iframe = this.getIframeEl();
    if (iframe) {
      iframe.contentWindow?.postMessage(
        iframe.dataset.videoType === 'youtube'
          ? '{"event":"command","func":"playVideo","args":""}'
          : '{"method":"play"}',
        '*'
      );
    } else {
      const video = this.getVideoEl();
      if (video) {
        // ensure mute preference honored when starting
        if (video.muted !== this.getStoredMuted()) {
          video.muted = this.getStoredMuted();
          this.applyMuteUI(video.muted);
        }
        Promise.resolve(video.play()).catch(() => {});
      }
    }
    this.isPlaying = true;
    this.updatePlayPauseHint(true);
    this.updateStateClasses('playing');
  }

  /**
   * Pauses the media
   */
  pauseMedia() {
    const iframe = this.getIframeEl();

    if (iframe) {
      iframe.contentWindow?.postMessage(
        iframe.dataset.videoType === 'youtube'
          ? '{"event":"command","func":"pauseVideo","args":""}'
          : '{"method":"pause"}',
        '*'
      );
    } else {
      this.getVideoEl()?.pause();
    }
    this.isPlaying = false;

    if (this.getAttribute('data-media-loaded')) {
      this.updatePlayPauseHint(false);
      // Only mark paused for hosted videos
      this.updateStateClasses('paused');
    }
  }
}

if (!customElements.get('deferred-media')) {
  customElements.define('deferred-media', DeferredMedia);
}

/**
 * A product model
 */
class ProductModel extends DeferredMedia {
  #abortController = new AbortController();

  loadContent() {
    super.loadContent();

    Shopify.loadFeatures([
      {
        name: 'model-viewer-ui',
        version: '1.0',
        onLoad: this.setupModelViewerUI.bind(this),
      },
    ]);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController.abort();
  }

  pauseMedia() {
    super.pauseMedia();
    this.modelViewerUI?.pause();
  }

  playMedia() {
    super.playMedia();
    this.modelViewerUI?.play();
  }

  /**
   * @param {Error[]} errors
   */
  async setupModelViewerUI(errors) {
    if (errors) return;

    if (!Shopify.ModelViewerUI) {
      await this.#waitForModelViewerUI();
    }

    if (!Shopify.ModelViewerUI) return;

    const element = this.querySelector('model-viewer');
    if (!element) return;

    const signal = this.#abortController.signal;

    this.modelViewerUI = new Shopify.ModelViewerUI(element);
    if (!this.modelViewerUI) return;

    this.playMedia();

    // Track pointer events to detect taps
    let pointerStartX = 0;
    let pointerStartY = 0;

    element.addEventListener(
      'pointerdown',
      (/** @type {PointerEvent} */ event) => {
        pointerStartX = event.clientX;
        pointerStartY = event.clientY;
      },
      { signal }
    );

    element.addEventListener(
      'click',
      (/** @type {PointerEvent} */ event) => {
        const distanceX = Math.abs(event.clientX - pointerStartX);
        const distanceY = Math.abs(event.clientY - pointerStartY);
        const totalDistance = Math.sqrt(
          distanceX * distanceX + distanceY * distanceY
        );

        // Try to ensure that this is a tap, not a drag.
        if (totalDistance < 10) {
          // When the model is paused, it has its own button overlay for playing the model again.
          // If we're receiving a click event, it means the model is playing, all we can do is pause it.
          this.pauseMedia();
        }
      },
      { signal }
    );
  }

  /**
   * Waits for Shopify.ModelViewerUI to be defined.
   * This seems to be necessary for Safari since Shopify.ModelViewerUI is always undefined on the first try.
   * @returns {Promise<void>}
   */
  async #waitForModelViewerUI() {
    const maxAttempts = 10;
    const interval = 50;

    for (let i = 0; i < maxAttempts; i++) {
      if (Shopify.ModelViewerUI) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

if (!customElements.get('product-model')) {
  customElements.define('product-model', ProductModel);
}
