;(function ($) {
  "use strict";

  var HDRN = window.HDRN = window.HDRN || {};

  var MIN_INTERVAL = 1;

  var ANNOTATION_DP_TIME = 5000;

  var ANNOTATION_TMPL = "<div class=\"hr-annotations\">" +
                          "<div class=\"annotations-track-container\">" +
                            "<div class=\"annotations-track\"></div>" +
                            "<div class=\"annotation-blocks-wrapper\">" +
                              "<div class=\"annotation-blocks\">" +
                              "</div>" +
                            "</div>" +
                          "</div>" +
                        "</div>";

  var ANNOTATION_BLK_TMPL = "<div class=\"block\" />";
 
  var uniqueId = 0;

  function getUniqueId () {
   
    uniqueId += 1;
    return uniqueId; 
  }

  function AnnotationBlock (data, annotations) {
 
    this.id = getUniqueId(); 
    this.$el = $(ANNOTATION_BLK_TMPL);
    this.data = data;

    var diffTime = annotations.endTime - annotations.startTime;

    var position = (data[0]/diffTime)*100;

    var dpDuration = data[2] || ANNOTATION_DP_TIME;

    dpDuration = (dpDuration/diffTime)*100;

    this.$el.css({"left": position + "%", "width": dpDuration + "%"});

    annotations.$blocksContainer.append(this.$el);

    this.collection[this.id] = this;
  }

  AnnotationBlock.prototype.collection = {};

  function genAnnotationsTl (annotations) {

    var annotationsTimeline = {};
    var timeElapsed = 0;

    for (var index in annotations) {

      index = parseInt(index);
   
      var annotation = annotations[index],
          nextAnnotation = annotations[index + 1],
          annotationSt = annotation[0],
          annotationDp = annotation[2] || ANNOTATION_DP_TIME,
          annotationEt = annotationSt + annotationDp;

      if (nextAnnotation && (nextAnnotation[0] < annotationEt)) {
        
        annotationEt = nextAnnotation[0];
      }

      if (timeElapsed < annotationSt) {

        for (;timeElapsed < annotationSt; timeElapsed += MIN_INTERVAL) {
          
          annotationsTimeline[timeElapsed] = null;
        }
      }

      /* jshint validthis: true */ 
      var annotationBlock = new AnnotationBlock(annotation, this);

      for (;timeElapsed < annotationEt; timeElapsed += MIN_INTERVAL) {
    
        annotationsTimeline[timeElapsed] = annotationBlock.id;
      }
    }
    
    return annotationsTimeline;
  }

  /** All the three parameters are required, else it breaks
   ** TODO: Validate passed parameters
   ** videoOptions should contain the following the data as key-value pairs
   ** width, height, vidUrl or vidId, autoplay, type(youtube, html5, vimeo etc.)
   **/ 
  function Annotation ($annotationsCont, data, videoOptions) {
   
    var that = this;

    this.data = data;

    this.$container = $($annotationsCont);

    this.startTime = 0;
    this.endTime = 0;

    this.$el = $(ANNOTATION_TMPL);
    this.$blocksContainer = this.$el.find(".annotation-blocks");

    this.player = null;
    this.playerId = "vid-" + getUniqueId();
    this.$player = $("<div id=\"" + this.playerId + "\" />");
    this.videoApi = null;

    this.isInitialized = false;

    this.$container.append(this.$player);

    var annotationsTimeline = {},
        annotationsTimer = null;

    function showAnnotation () {

      var currentTime = parseInt(that.player.getCurrentTime()*1000),
          floor = currentTime%MIN_INTERVAL;
    
      floor = currentTime - floor;
          
      floor = floor < 0?0:floor;
      
      var currentAnnotation = annotationsTimeline[floor];

      if (currentAnnotation) {
        
        currentAnnotation = AnnotationBlock.prototype.collection[currentAnnotation];
        currentAnnotation.show();
      } else {
      
        hideAnnotation();  
      }
    }

    function hideAnnotation () {
    
      AnnotationBlock.prototype.currentAnnotation.hide();  
    }

    function startAnnotations () {
    
      annotationsTimer = window.setInterval(function () {
      
                         showAnnotation();
                       }, MIN_INTERVAL);

      showAnnotation();
    }

    function pauseAnnotations () {
    
      window.clearInterval(annotationsTimer);  
    }

    function endAnnotations () {
    
      hideAnnotation();
      pauseAnnotations();  
    }

    var playerReq = null;

    this.getPlayer = function () {
      
      var _d = $.Deferred();

      if (playerReq) {
      
        _d = playerReq;
      } else {
        
        playerReq = _d;

        var api;

        if (videoOptions.type === "youtube") {
        
          api = this.videoApi = window.YT;

          var playerOptions = {
                                width: videoOptions.width,
                                height: videoOptions.height,
                                videoId: videoOptions.videoId
                              };
          
          if (videoOptions.autoplay) {
         
            playerOptions.playerVars = {"autoplay": 1};  
          }

          var player = new api.Player(this.playerId, playerOptions);

          player.addEventListener("onReady", function () {
          
            that.player = player;
            _d.resolve(player);
          });

          player.addEventListener("onError", function () {
          
            window.alert("Unable to load the youtube video");  
          });
        }
      }

      return _d;
    };

    this.initPlayer = function () {
     
      this.getPlayer().done(function (player) {

        //Any specific code required for the player can be written here
        if (videoOptions.type === "youtube") {
        
          that.endTime = parseInt(player.getDuration()*1000);
        }
      });
    };

    this.initAnnotations = function () {

      if (that.isInitialized) {
      
        return;  
      }

      this.getPlayer().done(function (player) {

        that.$container.append(that.$el);

        annotationsTimeline = that.genAnnotationsTl(data);
              
        if (videoOptions.type === "youtube") {
        
          player.addEventListener("onStateChange", function (event) {
          
            switch (event.data) {
            
              case that.PlayerState.PLAYING:
                startAnnotations();
                break;
                
              case that.PlayerState.ENDED:
                endAnnotations();
                break;
                
              case that.PlayerState.PAUSED:
                pauseAnnotations();
                break;
            }
          });  
        }

        that.isInitialized = true;
      });
    };

    this.initPlayer();

    this.initAnnotations();
  }

  Annotation.prototype.genAnnotationsTl = genAnnotationsTl;

  HDRN.Annotation = Annotation;

}(window.jQuery));
