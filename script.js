var editor;
var worker;
var Range;
var errorMarker=false;
var lastError;

function messageFromWorker(event){
   var $m=$("#misc");
   if(errorMarker){
      editor.session.removeMarker(errorMarker);
      errorMarker=false;
   }
   if(event.data.error){
      var e=event.data;
      var ln=e.ln;
      $m.append("<span>Line "+ln+" </span> : ");
      $m.append("<b>"+e.name+"</b><br>");
      if(e.msg) $("#misc").append("<pre>"+e.msg+"</pre>");
      errorMarker = editor.session.addMarker(new Range(ln-1, 0, ln-1, 999), "error", "line");
      lastError = e;
      return;
   }
   if(event.data.print){
      $m.append("<pre>"+event.data.print+"</pre>");
      return;
   }
   if(event.data.graph){
      showGraph(event.data.graph);
      return;
   }
   if(event.data.termine!==undefined){
      $m.append("<i>Program terminé avec le code "+event.data.termine+"</i>");
   }

   for(var i=0; i<event.data.length; i++){
      if(event.data[i]=="INVALID") $m.append("<span>###</span> ");
      else $m.append("<b>"+event.data[i]+"</b> ");
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
   if(worker) worker.terminate();
   worker = new Worker("interpret.js");
   worker.onmessage = messageFromWorker;
   worker.postMessage(editor.getValue());
   timeout=false;
   $("#misc").empty();
}

function showGraph(str){
   try{
      v = Viz(str);
      $("#show").html(v);
   }catch(e){
      console.log("Viz", str);
      console.log(e);
   }
}

function init(){
   Range = ace.require('ace/range').Range;
   editor = ace.edit("editor");
   editor.setTheme("ace/theme/monokai");
   editor.getSession().setMode("ace/mode/python");
   editor.setShowPrintMargin(false);
   editor.$blockScrolling = Infinity;
   editor.getSession().setTabSize(3);

   editor.getSession().on('change', oneditorChange);
   editor.setValue(ex1, -1);
   oneditorChange();
}

$(init);


// DEBUG
var ex1=`#
Arete [A,B]
Arete [A,B]
Arete [A,C]
Arete [A,C]
Arete [A,D]
Arete [B,D]
Arete [C,D]

def unchemin():
   for [x,y] in U:
      [x,y].passe=0
   s=random(X)
   n=0
   while True:
      [x,y]=random(Gamma(s), passe==0)
      if [x,y]==null: break
      s=y
      [x,y].passe=1
      n++
   return n

nmax=0
while True:
   n=unchemin()
   if n>nmax:
      nmax=n
   print ("n=",n, " nmax=",nmax)
`;
