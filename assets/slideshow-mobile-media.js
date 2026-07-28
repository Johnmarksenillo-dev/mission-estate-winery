(() => {
  if (window.slideshowMobileMediaLoaded) return;

  window.slideshowMobileMediaLoaded = true;

  const SELECTORS = {
    container: '[data-slideshow-responsive-media]',
    slide: '.slideshow__slide',
    video: '[data-slideshow-video]',
    videoSource: 'source[data-src]',
  };

  const VIEWPORT = {
    desktop: 'desktop',
    mobile: 'mobile',
  };

  const mobileScreen = window.matchMedia('(max-width: 749px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  class SlideshowMobileMedia {
    constructor(container) {
      this.container = container;
      this.slide = container.closest(SELECTORS.slide);
      this.videos = Array.from(container.querySelectorAll(SELECTORS.video));

      this.handleStateChange = this.updateVideos.bind(this);
      this.slideObserver = new MutationObserver(this.handleStateChange);

      this.addEventListeners();
      this.observeSlideVisibility();
      this.updateVideos();
    }

    get activeViewport() {
      const hasMobileMedia = this.container.dataset.hasMobileMedia === 'true';

      if (mobileScreen.matches && hasMobileMedia) {
        return VIEWPORT.mobile;
      }

      return VIEWPORT.desktop;
    }

    get slideIsActive() {
      return !this.slide || this.slide.getAttribute('aria-hidden') !== 'true';
    }

    addEventListeners() {
      mobileScreen.addEventListener('change', this.handleStateChange);
      reducedMotion.addEventListener('change', this.handleStateChange);
      document.addEventListener('visibilitychange', this.handleStateChange);
    }

    observeSlideVisibility() {
      if (!this.slide) return;

      this.slideObserver.observe(this.slide, {
        attributes: true,
        attributeFilter: ['aria-hidden'],
      });
    }

    isVideoForActiveViewport(video) {
      return video.dataset.slideshowMediaViewport === this.activeViewport;
    }

    setVideoPoster(video) {
      const posterUrl = video.dataset.poster;
      if (!posterUrl || video.poster) return;

      video.poster = posterUrl;
    }

    loadVideoSource(video) {
      const source = video.querySelector(SELECTORS.videoSource);
      if (!source || source.hasAttribute('src')) return;

      source.src = source.dataset.src;
      video.load();
    }

    videoCanPlay(video) {
      return (
        this.isVideoForActiveViewport(video) &&
        this.slideIsActive &&
        !reducedMotion.matches &&
        document.visibilityState !== 'hidden'
      );
    }

    playVideo(video) {
      this.loadVideoSource(video);
      video.muted = true;

      const playPromise = video.play();

      // Some browsers can block autoplay. The poster remains visible if that happens.
      if (playPromise) {
        playPromise.catch(() => {});
      }
    }

    pauseVideo(video) {
      video.pause();
    }

    updateVideos() {
      this.videos.forEach((video) => {
        if (this.isVideoForActiveViewport(video)) {
          this.setVideoPoster(video);
        }

        if (!this.videoCanPlay(video)) {
          this.pauseVideo(video);
          return;
        }

        this.playVideo(video);
      });
    }

    destroy() {
      this.videos.forEach((video) => this.pauseVideo(video));
      this.slideObserver.disconnect();

      mobileScreen.removeEventListener('change', this.handleStateChange);
      reducedMotion.removeEventListener('change', this.handleStateChange);
      document.removeEventListener('visibilitychange', this.handleStateChange);

      delete this.container.slideshowResponsiveMedia;
    }
  }

  class SlideshowMobileMediaManager {
    static initialize(root = document) {
      root.querySelectorAll(SELECTORS.container).forEach((container) => {
        if (container.slideshowResponsiveMedia) return;

        container.slideshowResponsiveMedia = new SlideshowMobileMedia(container);
      });
    }

    static destroy(root) {
      root.querySelectorAll(SELECTORS.container).forEach((container) => {
        if (!container.slideshowResponsiveMedia) return;

        container.slideshowResponsiveMedia.destroy();
      });
    }
  }

  SlideshowMobileMediaManager.initialize();

  document.addEventListener('shopify:section:load', (event) => {
    SlideshowMobileMediaManager.initialize(event.target);
  });

  document.addEventListener('shopify:section:unload', (event) => {
    SlideshowMobileMediaManager.destroy(event.target);
  });
})();
