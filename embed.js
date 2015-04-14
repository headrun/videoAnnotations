;(function () {
  "use strict";

  var EL_ID = "yt-embed",
      VID_ID = "nmwXdGm89Tk";

  var annotationsTimeline = {};

  function initPlayer () {

    var videoEl = document.getElementById(EL_ID),
        dimentions = videoEl.parentNode.getBoundingClientRect();

    var player = new window.HDRN.Annotation("#" + EL_ID, annotationsTimeline, {

                                       type: "youtube",
                                       width: dimentions.width,
                                       height: dimentions.height,
                                       videoId: VID_ID,
                                       autoplay: true});

    return player;
  }

  document.body.onload = function () {
    
    var req = new XMLHttpRequest();

    req.open("GET", "annotations.json", true);

    req.onload = function () {
      
      if (req.status >= 200 && req.status < 400) {
      
        var annotations = JSON.parse(req.responseText);

        annotationsTimeline = annotations;

        initPlayer();  
      } else {
      
        window.alert("An error occured while getting the data!");  
      }
    };

    req.onerror = function () {
    
      window.alert("Unable to connect to server!");  
    };

    req.send();
  };
}());
