## weewx-live : marque (logo, nom, sous-titre) et menu des pages d'archives (dossier archive/).
  <header class="top">
    <div class="brand">
#if $livejson_logo
#set $src = $livejson_logo.src if $livejson_logo.src.startswith(('http://', 'https://', '/')) else '../' + $livejson_logo.src
      <img class="brand-logo" src="$src" alt="$livejson_logo.alt" height="$livejson_logo.height" style="height:${livejson_logo.height}px">
#end if
      <div class="brand-text">
        <h1 id="station-name">$livejson_station</h1>
        <p class="subtitle">$livejson_hardware</p>
      </div>
    </div>
    <div class="status">
      <span class="pill pill-arch"><span class="dot"></span><span class="txt">Archives</span></span>
    </div>
  </header>
  <nav id="menu" class="menu" aria-label="Pages"></nav>
