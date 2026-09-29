# Homepage video and European connections

The homepage now uses aerial container-terminal footage and an interactive European sourcing map. Selecting France, Germany, Italy, Poland, Türkiye or Georgia redraws the illustrative connections and updates the manufacturer-directory link. No supplier coverage or shipment data is fabricated.

## Asset provenance

- Video: Toàn BDS, [Aerial View of a Bustling Container Port](https://www.pexels.com/video/aerial-view-of-a-bustling-container-port-32750404/), retrieved 29 September 2026. [Pexels license](https://www.pexels.com/license/) permits website use and modification. Source file: `13962347_2560_1440_60fps.mp4`. Edited excerpt: seconds 3–21, 24 fps, no audio, reduced saturation, H.264 fast-start. Desktop: 1600 × 900; mobile: 640 × 800 portrait crop. Poster derived from the same excerpt. These are illustrative logistics images, not GSL premises or a referenced supplier.
- Geographic outlines: Natural Earth `ne_110m_admin_0_countries.geojson`, from the [Natural Earth repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson). [Public domain terms](https://www.naturalearthdata.com/about/terms-of-use/). Cropped Mercator view, longitude −13° to 47°, latitude 33° to 64°, simplified to a local 33 KB SVG. Route overlays and styling created for GSL.
- Public credits updated at `/credits`.

## Behaviour and checks

- TypeScript and targeted lint checked; existing image-element lint warning remains.
- Browser reviewed in French at desktop and 390 × 844; no horizontal overflow.
- Correct desktop/mobile video source selected, playback confirmed.
- Map country selection updates the route origin and manufacturer URL. Georgia link followed to the directory with country and French language preserved.
- Pause control stops map animations. IntersectionObserver pauses them outside the viewport. Reduced-motion preference disables map animation and video autoplay.
- Video retains its poster for data-saving connections and failed autoplay.
- Existing hosted catalogue/account configuration is outside this visual change.

## Revision: country page and longer film

At the user’s request, the map is now on `/pays`, removed from both live and demo homepages. The country directory and its filters remain accessible below the map. The same container-terminal footage now runs for 40 seconds (source seconds 0–33.333, slowed to 5/6 speed) instead of 18 seconds. Desktop is 1440 × 810; mobile remains 640 × 800. Poster updated to match the opening frame, with versioned asset URLs to avoid stale browser caches. Build and targeted lint pass (existing image warning only). Browser confirms zero maps on the homepage, 40-second playback, and the map on the country page.
