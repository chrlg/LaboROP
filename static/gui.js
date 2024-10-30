// File containing all GUI aspect (buttons, divs and stuff. With exclusion of drawings, in srendering)

let $extragraph, $tabs, $unrollExtragraph;
let $progress, $progressval, $userStatus;
let $run, $stop, $argv;

function showTab(t, button=false){
    $(".show").removeClass("selected");
    $("#"+t).addClass("selected");
    $("#tabs button").removeClass("selected");
    if(button) button.addClass("selected");
    else $("#tabs button[data-target='"+t+"']").addClass("selected");
    if(t=='files') initFiles();
    if(t=='show' && button.attr('data-graph')){
        let gname=button.attr('data-graph');
        _graphes[gname].shown=false;
        refreshGraphs();
    }
}

// Initialise callbacks for split handles that allows to change relative size of gui main boxes
function splitMove(){
   function changeSplit(svw){
      $("#ecrangauche").css("width", ""+svw+"vw");
      $("#splithandle").css("left", ""+svw+"vw");
      $("#ecrandroit").css("left", "calc("+svw+"vw + 6px)");
      $("#ecrandroit").css("width", "calc("+(100-svw)+"vw - 6px)");
   }
   function changeSplitD(svh){
      $("#hautdroit").css("height", ""+(svh-4)+"vh");
      $("#splithandled").css("top", ""+svh+"vh");
      $("#misc").css("top", "calc("+svh+"vh + 4px)");
   }

   let winit=false, hinit=false;
   $("#splithandle").mousedown(function(e){
      winit=$("body").width();
      e.preventDefault();
      return false;
   });
   $("#splithandled").mousedown(function(e){
      hinit=$("#ecrandroit").height();
      e.preventDefault();
      return false;
   });
   $(document).mousemove(function(e){
      if(winit) changeSplit(e.clientX*100.0 / winit);
      else if(hinit) changeSplitD(e.clientY*100.0 / hinit);
   });
   $(document).mouseup(function(e){
      winit=false;
      hinit=false;
   });
}

function setProgress(x){
    if(x<0 || x>1){
        $progress.classList.add('over');
        $progress.style.right="0vw";
        $progressval.textContent = ''+x;
    }else{
        $progress.classList.remove('over');
        $progress.style.right = `${9-x*9}vw`;
        $progressval.textContent = (x*100).toFixed(2)+'%';
    }
}

function setUserStatus(t, col){
    if(col) $userStatus.style.color=col;
    $userStatus.textContent=t;
}

function setStateRunning(){
    $run.disabled=true;
    $stop.disabled=false;
}
function setStateStop(){
    $run.disabled=false;
    $stop.disabled=true;
}

function initGui(){
    // Some global vars for dom quick access (objective : no jquery)
    $extragraph=document.getElementById('extragraph');
    $tabs=document.getElementById('tabs');
    $unrollExtragraph=document.getElementById('unrollExtragraph');
    $progress=document.getElementById('progress');
    $progressval=document.getElementById('progressval');
    $userStatus=document.getElementById('userStatus');
    $stop=document.getElementById('stop');
    $run=document.getElementById('run');
    $argv=document.getElementById('argv');

    // Initialise split handlers
    splitMove();

    // Tabs
    $("#tabs button[data-target]").click(function(e){
        let t=$(this).attr("data-target");
        showTab(t, $(this));
        $extragraph.classList.remove('unrolled');
    });
    $("#tabs button[data-target='show']").click(function() {
        refreshGraphs();
    });

    $unrollExtragraph.addEventListener('click', function(){
        $extragraph.classList.toggle('unrolled');
        showTab('show');
    });

    // Run/stop
    $run.addEventListener('click', function(){saveCode(true);});
    $stop.addEventListener('click', function(){if(timeout) clearTimeout(timeout); Terminate();});

    // Start with nothing running
    setStateStop();
}
