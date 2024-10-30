var editor;
var worker;
var Range;
var errorMarker=false;
var lastError;
var timeoutLen=120000;
var timeout=false;

function messageFromWorker(event){
    if(event.data.error){
        let e=event.data;
        let ln=e.ln;
        let $e=$("#errors");
        $e.append("<span>Line "+ln+" </span> : ");
        $e.append("<b>"+e.name+"</b><br>");
        if(e.msg) $e.append("<pre>"+e.msg+"</pre>");
        $e.append("<div>Consultez la documentation fournie par la fonction <b>help()</b></div>");
        errorMarker = editor.session.addMarker(new Range(ln-1, 0, ln-1, 999), "error", "line");
        lastError = e;
        worker=false;
        setStateStop();
        if(timeout) clearTimeout(timeout); timeout=false;
        let $m=$("#misc")[0];
        $m.scrollTop=$m.scrollHeight;
        return;
    }
    if(event.data.print){
        $("#console").text(event.data.print);
        let $m=$("#misc")[0];
        $m.scrollTop=$m.scrollHeight;
        return;
    }
    if(event.data.graph){
        updateGraph(event.data.graph);
        return;
    }
    if(event.data.mapres){
        $("#svgcont").hide();
        $("#canvascont").show();
        showReseau(event.data.mapres, event.data.arcs, event.data.name, event.data.bound, event.data.arrow);
        return;
    }
    if(event.data.progress){
        setProgress(event.data.progress);
        return;
    }
    if(event.data.status){
        setUserStatus(event.data.status, event.data.color);
        return;
    }
    if(event.data.termine!==undefined){
        $("#status").html("<i>Program terminé avec le code "+event.data.termine+" en "+event.data.opcnt+" opérations</i>");
        worker=false;
        if(timeout) clearTimeout(timeout); timeout=false;
        setStateStop();
        let $m=$("#misc")[0];
        $m.scrollTop=$m.scrollHeight;
    }
    if(event.data.store){
        window[event.data.name]=event.data.store;
    }
}

function oneditorChange(e){
}

function runCode(){
    if(worker) worker.terminate();
    if(timeout) clearTimeout(timeout);
    timeout=false;
    worker=false;
    worker = new Worker("interpret.js", {type:"module"});
    worker.onmessage = messageFromWorker;
    worker.onerror = (e) => {console.log(e);};
    worker.postMessage(editor.getValue());
    setStateRunning();
    timeout=setTimeout(Terminate, timeoutLen);
    $("#console").empty();
    $("#status").empty();
    $("#errors").empty();
    $("#svgcont").empty();
    $extragraph.innerHTML='';
    setProgress(0);
    setUserStatus('');
    $tabs.classList.remove('multextra');
    _graphes={Gr:true};
    if(errorMarker){
        editor.session.removeMarker(errorMarker);
        errorMarker=false;
    }
    return true;
}

function Terminate(){
    timeout=false;
    if(worker) worker.terminate();
    worker=false;
    setStateStop();
    $("#status").html("<i>Programme en boucle, interrompu au bout de "+(timeoutLen/1000)+" secondes</i>");
}

function init(){

   // Ace init
   Range = ace.require('ace/range').Range;
   editor = ace.edit("editor");
   editor.setTheme("ace/theme/monokai");
   editor.getSession().setMode("ace/mode/python");
   editor.setShowPrintMargin(false);
   editor.$blockScrolling = Infinity;
   editor.getSession().setTabSize(3);
   // Hors sujet :
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-e"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-shift-e"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-0"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-s"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-shift-/"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-["];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-]"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["alt-shift-x"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-u"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-shift-u"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-up"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-down"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-up"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-down"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-left"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-shift-right"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-right"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-left"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-l"];
   delete editor.keyBinding.$defaultHandler.commandKeyBinding["ctrl-alt-a"];

   editor.commands.addCommand({name:"ShowGraph", bindKey:{win:"alt-g",mac:"Alt-g"},
         exec:()=>{showTab("show");}});
   editor.commands.addCommand({name:"ShowFiles", bindKey:{win:"alt-f",mac:"Alt-f"},
         exec:()=>{showTab("files");}});
   editor.commands.addCommand({name:"Stop", bindKey:{win:"alt-c",mac:"Alt-c"},
         exec:()=>{if(timeout) clearTimeout(timeout); Terminate();}});
   editor.commands.addCommand({name:"Save&Run", 
         bindKey:{win:"Ctrl-s", mac:"Command-s"}, exec:()=>saveCode(true)});
   editor.commands.addCommand({name:"Run", 
         bindKey:{win:"Alt-r", mac:"Command-Alt-r"}, exec:runCode});
   editor.commands.addCommand({name: "showKeyboardShortcuts",
         bindKey: {win: "Ctrl-Alt-h", mac: "Command-Alt-h"},
         exec: function(editor) {
            ace.config.loadModule("ace/ext/keybinding_menu", function(module) {
               module.init(editor);
               editor.showKeyboardShortcuts()
            })
         }
   });

    editor.getSession().on('change', oneditorChange);
    editor.setOption("showInvisibles", true);

    initGui();

   // Fichiers
   initCloud();

   // Zoom dans show
   $("#show").bind("mousewheel DOMMouseScroll", function(e){
      if(!e.altKey) return;
      let ee=e.originalEvent;
      let delta=ee.detail?ee.detail:ee.deltaY;
      doZoom(delta);
      e.preventDefault();
      return false;
   });

   setInterval(refreshGraphs, 500);
}

window.onload=init;
