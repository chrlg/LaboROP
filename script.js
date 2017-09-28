var editor;
var worker;
var Range;
var errorMarker=false;

function messageFromWorker(event){
   var $m=$("#misc");
   $m.empty();
   if(errorMarker){
      editor.session.removeMarker(errorMarker);
      errorMarker=false;
   }
   if(event.data.ERROR){
      var e=event.data;
      var ln=e.ln;
      $("#misc").append("<span>Line "+ln+" </span>");
      $("#misc").append("<b>"+e.ERROR+"</b>");
      errorMarker = editor.session.addMarker(new Range(ln-1, 0, ln-1, 999), "error", "line");
      return;
   }
   for(var i=0; i<event.data.length; i++){
      var tok=event.data[i];
      if(tok.t=="BEGIN") $m.append("<b>{</b>");
      else if(tok.t=="END") $m.append("<b>}</b>");
      else if(tok.t=="STRING") $m.append("«"+tok.v+"»");
      else if(tok.t=="I") $m.append("<i>"+tok.v+"</i>");
      else if(tok.t=="OP") $m.append("<b>"+tok.v+"</b>");
      else if(tok.t=="NL") $m.append("<br/>");
      else $m.append("<span>"+tok.t+":"+tok.v+"</span>");

      $m.append(" ");
   }
}

var timeout=false;
function oneditorChange(e){
   if(timeout){
      clearTimeout(timeout);
      timeout=false;
   }
   timeout = setTimeout(realEditorChange, 2000);
}

function realEditorChange(){
   worker.postMessage(editor.getValue());
   timeout=false;
}

function init(){
   Range = ace.require('ace/range').Range;
   editor = ace.edit("editor");
   editor.setTheme("ace/theme/monokai");
   editor.getSession().setMode("ace/mode/python");
   editor.setShowPrintMargin(false);
   editor.getSession().setTabSize(3);

   v = Viz("digraph { A->B; }");
   $("#show").html(v);

   worker = new Worker("interpret.js");
   worker.onmessage = messageFromWorker;

   editor.getSession().on('change', oneditorChange);
}

$(init);
