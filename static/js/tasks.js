/*
* Depends on:
* - URL.addIdea
* - URL.getNewIdeas
* - ENV.condition
*/

$(function(){

    var maxCatCharacters = 20;
    var maxIdeaCharacters = 1000;
    var validationError = false;

    var userIdeaCounter = 0;
    var lastUpdateTime = null;
    var othersIndex = 0;

    var maxTime = ENV.ideationTime; // In minutes

    // Start timer
    var interval = window.setInterval(function(){
        var remaining = moment.duration(maxTime,'minutes').subtract(moment.utc(ENV.startTime).countdown(moment.utc()));
        var minutes = remaining.get('minutes');
        var seconds = remaining.get('seconds');

        // Dealing with formatting--quick and dirty
        var minutesPadding = minutes < 10 ? "0" : "";
        var secondsPadding = seconds < 10 ? "0" : "";
        $("#timer").text(minutesPadding + minutes + ":" + secondsPadding + seconds);

        if(minutes <= 0 && seconds <= 0){
            // Time's up
            clearInterval(interval);
            $("#timer").text("00:00");
            finishSession();
        }
    }, 1000);
    
    $("#idea-submit").click(function(e){
        // get inputs
        var ideaInput = $("#idea-input");
        var conceptsInput = $("#concepts-input");
        // get their content
        var text = ideaInput.val();
        var concepts = parseConcepts(conceptsInput.val());

        if(!text){
            alert("The idea text is mandatory!");
            validationError = true;
        } else if(!concepts){
            alert("The concepts are mandatory!");
            validationError = true;
        } else if (text.length > maxIdeaCharacters){
            alert("You can use at most " + maxIdeaCharacters + " characters in your idea");
            validationError = true;
        } else if (concepts.length < 1){
            alert("You must insert at least one tag for your idea!");
            validationError = true;
        }
        
        if(!validationError){
            // clear inputs
            ideaInput.val("");
            conceptsInput.val("");

            // Increase idea counter
            userIdeaCounter++;
            
            // Send idea to server
            addIdea({text:text, concepts:concepts}, function(){
                // Add idea to user's view
                $("#no-user-idea").remove();
                // Build concepts string
                var conceptsStr = "";
                for (var i = 0; i < concepts.length; i++){
                    conceptsStr += "<span>";
                    conceptsStr += concepts[i]
                    conceptsStr += "</span>";
                }
                
                $("#user-ideas").prepend("<li class='list-group-item'><p>" + text + conceptsStr + "</p></li>")    
            });
        }    
    });

    $("#inspiration-request").click(function(e){
        $.ajax({
            type: "GET",
            url: URL.getIdea,
            success: getIdeaForTask
        });
    });

    $("#task-submit").click(function(e){
        var originalityInput = $("input[name=originality]:checked");
        var usefulnessInput = $("input[name=usefulness]:checked");
        var similarityInput = $(".ideaWrapper.selected input");
        var confidenceInput = $("input[name=confidence]:checked");

        var ideaIds = JSON.parse($("#idea-id").val());
        var originality = originalityInput.val();
        var usefulness = usefulnessInput.val();
        var closer_index = similarityInput.val();
        var confidence = confidenceInput.val();

        if(ENV.condition === 3 && (!originality || !usefulness)){
            alert("Both ratings are mandatory!");
        } else if(ENV.condition === 4 && (!closer_index || !confidence)){
            alert("You must select the most similar idea and indicate your confidence level!");
        } else {
            // Submit
            $.ajax({
                type: "POST",
                url: URL.rateIdea,
                data: {
                    ideaIds: ideaIds,
                    originality: originality,
                    usefulness: usefulness,
                    closer_index: closer_index,
                    confidence: confidence
                },
                success: rateIdea
            })
        }
    });

    $("#close-idea").click(function(e){
        $(".toggle").toggleClass("hidden");
        $("#pretask-instructions").show();
        $("#ideas-panel").empty();
    });
    
    $("#get-code").click(function(){
        getCodeClick();
    });

    var bindIdeaWrapperClick = function(){
        $(".clickable").bind('click', function(event){
            $(".ideaWrapper.selected").toggleClass('selected');
            $(event.target).toggleClass('selected');
        });
    };

    var addIdea = function(idea, callback){
        $.ajax({
            type: "POST",
            url: URL.addIdea,
            data: {
                "idea": idea.text,
                "concepts": idea.concepts
            },
            success: callback
        });
    };

    var parseConcepts = function(string){
        concepts = string.split(',');
        conceptsOutput = []
        for(var i = 0; i < concepts.length; i++){
            var concept = concepts[i].trim().replace('#','');
            if (concept && concept.length !== 0){
                conceptsOutput.push(concept);
            }
        }
        return conceptsOutput;
    };
    
    var getIdeaForTask = function(data){
        var ideas = JSON.parse(data)
        
        if(!ideas.length){
            alert("No other ideas were submitted yet. Check again later.");
        } else {
            var ideaPanel = $("#ideas-panel");
            var ideaContainer = $("<div id='ideas-container'/>");
            ideaContainer.empty(); // clear container
            var ids = [];
            // Appending ideas to panel
            for(var i = 0; i < ideas.length; i++){
                var idea = ideas[i];
                var wrapper = $("<p></p>").text(idea.idea);
                // If condition == 4, use the first idea as the seed
                if(i == 0 && ENV.condition == 4) {
                    wrapper.addClass('seedIdea');
                    wrapper.html('<strong>Seed Idea:</strong><br/>' + wrapper.text());
                    ideaPanel.append(wrapper);
                } else {
                    wrapper.addClass('ideaWrapper');
                    wrapper.append($("<input type='hidden' value='"+i+"'/>"));
                    ideaContainer.append(wrapper);

                    if(ENV.condition == 4){
                        wrapper.addClass('clickable');
                    }
                }
                
                ids.push(idea.id);
            }
            ideaPanel.append(ideaContainer);

            $("#idea-id").val(JSON.stringify(ids));             
            $(".toggle").toggleClass("hidden");
            $("#pretask-instructions").hide();

            bindIdeaWrapperClick();
        }
    };

    var rateIdea = function(){
        var originalityInput = $("input[name=originality]:checked");
        var usefulnessInput = $("input[name=usefulness]:checked");
        var similarityInput = $("input[name=similarity]:checked");
        var confidenceInput = $("input[name=confidence]:checked");
        // The idea has been rated. Clear and empty everything
        $(".toggle").toggleClass("hidden");
        $("#pretask-instructions").show();
        $("#ideas-panel").empty();
        originalityInput.prop("checked", false);
        usefulnessInput.prop("checked", false);
        similarityInput.prop("checked", false);
        confidenceInput.prop("checked", false);



        $.web2py.flash("Your task has been submitted!", "");
    };

    var finishSession = function(){
        $("#time-over").show();
    };

    var surveyIsValid = function(){
        isValid = false;
        var usefulInspiration = $("#survey input[name=useful-inspiration]:checked").val();
        var openEnded = $("#survey textarea").val();

        if(!usefulInspiration || (!openEnded || openEnded.length > 1000)){
            isValid = false;
        } else {
            isValid = true;
        }
        return isValid;
    };

    var getCodeClick = function(){
        if(ENV.condition == 1){
            // Condition 1 has no survey. Get code.
            getCode();
        } else if(surveyIsValid()){
            // Post survey to server
            var usefulInspiration = $("#survey input[name=useful-inspiration]:checked").val();
            var openEnded = $("#survey textarea").val();
            $.ajax({
                type: "POST",
                url: URL.postSurvey,
                data: {usefulInspiration:usefulInspiration, openEnded:openEnded},
                success:function(data){

                }
            });   
            // Get code and display it
            getCode();
        } else {
            alert("Please, fill in all questions in the survey before clicking this button!");
        }
    };

    var getCode = function(){
        $.ajax({
            type: "GET",
            url: URL.getFinalID,
            success:function(data){
                $("#survey").hide();
                $("#final-id").css("display", "block").text(data);
            }
        });
    }

    $(".tooltip-toggle").tooltip(); // Tooltip


});

