;(function ($) {
  "use strict";

  var HDRN = window.HDRN = window.HDRN || {};

  var MIN_INTERVAL = 500;

  var ANNOTATION_DP_TIME = 60000;

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

  var POPOVER_TMPL = "<div class=\"popover bottom annotations-popover\">" +
                        "<div class=\"arrow\"></div>" +
                        "<h3 class=\"popover-title\">" +
                          "<span class=\"popover-title-text\"></span>" +
                          "<a class=\"anchorjs-link\" href=\"#popover-bottom\">" +
                            "<span class=\"anchorjs-icon\"></span>" +
                          "</a>" +
                        "</h3>" +
                        "<div class=\"popover-content\">" +
                          "<p class=\"popover-content-text\"></p>" +
                        "</div>" +
                      "</div>";
 
  var uniqueId = 0;

  function getUniqueId () {
   
    uniqueId += 1;
    return uniqueId; 
  }

  function AnnotationBlock (data, annotations) {
 
    var that = this;

    this.id = getUniqueId(); 
    this.$el = $(ANNOTATION_BLK_TMPL);
    this.data = data;
    this.annotations = annotations;
    this.$popover = annotations.$popover;

    var diffTime = annotations.endTime - annotations.startTime;

    var position = (data[0]/diffTime)*100;

    var dpDuration = data[2] || ANNOTATION_DP_TIME;

    dpDuration = (dpDuration/diffTime)*100;

    this.$el.css({"left": position + "%"});

    annotations.$blocksContainer.append(this.$el);

    var originalWidth = this.$el.width();

    this.$el.css({"width": dpDuration + "%"});

    // width should not be less than 20px
    if (this.$el.width() < originalWidth) {
    
      this.$el.width(originalWidth);  
    }

    this.persistPopover = false;

    this.bindEvents = function () {
      
      this.$el.on("mouseenter", function () {
       
                that.persistPopover = true;
                that.show();
              })
              .on("mouseleave", function () {
              
                that.persistPopover = false;
                that.hide();  
              })
              .on("click", function () {
                
                if (that.annotations.videoOptions.type === "youtube") {

                  that.annotations.player.seekTo(data[0]/1000, true);
                }
              });
    };

    this.bindEvents();

    this.collection[this.id] = this;
  }

  var blocks = AnnotationBlock.prototype;

  blocks.collection = {};
  blocks.currentAnnotation = null;

  blocks.show = function () {
   
    var currentAnnotation = this;

    if (blocks.currentAnnotation) {
   
      if (blocks.currentAnnotation.persistPopover)  {
      
        return;  
      } else if (blocks.currentAnnotation.id === currentAnnotation.id) {

        return;
      }

      blocks.hide();
    }
    
    /* jshint validthis: true */
    /* data of a specific AnnotationBlock instance */
    var position = currentAnnotation.$el.offset(),
        width = currentAnnotation.$el.width(),
        height = currentAnnotation.$el.height();

    var data = currentAnnotation.data;

    var $popover = currentAnnotation.$popover,
        popoverContent = data[1];

    $popover.find(".popover-content > .popover-content-text")
            .text(popoverContent);

    $popover.css({"left": position.left + (width/2) + "px",
                  "top": position.top + height + 5 + "px", // 5 is spacing on top
                  "margin-left": "-" + $popover.width()/2 + "px"
                })
            .addClass("in");

    blocks.currentAnnotation = currentAnnotation;
  };

  blocks.hide = function () {
    
    var currentAnnotation = blocks.currentAnnotation;

    if (!currentAnnotation) {
    
      return;
    } else if (currentAnnotation.persistPopover) {
      
      return;
    }

    currentAnnotation.$popover.removeClass("in");
    blocks.currentAnnotation = null;
  };

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

    this.videoOptions = videoOptions;
    this.player = null;
    this.playerId = "vid-" + getUniqueId();
    this.$player = $("<div id=\"" + this.playerId + "\" />");
    this.videoApi = null;

    this.isInitialized = false;

    this.$container.css({"position": "relative"})
                   .append(this.$player);

    this.$popover = $(POPOVER_TMPL);

    this.$container.append(this.$popover);

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
    
      AnnotationBlock.prototype.hide();  
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
            
              case that.videoApi.PlayerState.PLAYING:
                startAnnotations();
                break;
             
              case that.videoApi.PlayerState.BUFFERING:
                pauseAnnotations();
                break;
              
              case that.videoApi.PlayerState.ENDED:
                endAnnotations();
                break;
                
              case that.videoApi.PlayerState.PAUSED:
                pauseAnnotations();
                break;
            }
          }); 
          
          player.setPlaybackRate(1);
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
