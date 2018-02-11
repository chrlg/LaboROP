var editor;
var worker;
var Range;
var errorMarker=false;
var lastError;

var saveData = (function () {
   var a=$("<a></a>");
   $("body").append(a);
   a.css("display", "none");
   return function (fileName) {
        var val=editor.getValue(),
            blob = new Blob([val], {type: "octet/stream"}),
            url = window.URL.createObjectURL(blob);
        a.attr("href", url);
        a.attr("download", fileName);
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

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
      $m.append("<pre class='console'>"+event.data.print+"</pre>");
      return;
   }
   if(event.data.graph){
      showGraph(event.data.graph);
      return;
   }
   if(event.data.termine!==undefined){
      $m.append("<i>Program terminé avec le code "+event.data.termine+"</i>");
      if(event.data.tree) console.log(event.data.tree);
      console.log(event.data);
   }

   for(var i=0; i<event.data.length; i++){
      if(event.data[i]=="INVALID") $m.append("<span>###</span> ");
      else $m.append("<b>"+event.data[i]+"</b> ");
   }
}

var timeout=false;
function oneditorChange(e){
   if(e.lines.length<2) return;
   if(timeout){
      clearTimeout(timeout);
      timeout=false;
   }
   timeout = setTimeout(realEditorChange, 200);
}

function realEditorChange(){
   if(worker) worker.terminate();
   worker=false;
   worker = new Worker("interpret.js#"+Math.random());
   worker.onmessage = messageFromWorker;
   worker.postMessage(editor.getValue());
   timeout=setTimeout(Terminate, 20000);
   $("#misc").empty();
}

function saveCode(){
   localStorage.setItem("laborop_code", editor.getValue());
   realEditorChange();
}

function saveLocal(){
   saveData("konigsberg.rop");
}

function loadLocal(){
}

function Terminate(){
   timeout=false;
   worker.terminate();
   worker=false;
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
   editor.commands.addCommand({name:"CompileEtExec", bindKey:{win:"Ctrl-s", mac:"Command-s"}, 
                                 exec:saveCode});
   editor.commands.addCommand({name:"EnregistreLocalement", bindKey:{win:"Ctrl-q", mac:"Command-q"}, 
                                 exec:saveLocal});
   editor.commands.addCommand({name:"Charge", bindKey:{win:"Ctrl-l", mac:"Command-l"},
                                 exec:loadLocal});

   editor.getSession().on('change', oneditorChange);
   editor.setValue(ex2, -1);
   oneditorChange();

   setInterval(function(){
      if(worker) worker.postMessage("tick");
   }, 1000);
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
      [x,y]=random(aretes(s), passe==0)
      if [x,y]==null: break
      s=y
      [x,y].passe=1
      n++
   return n

nmax=0
for essai in range(0,1000):
   n=unchemin()
   if n>nmax:
      nmax=n
   print ("essai #",essai," n=",n, " nmax=",nmax)
`;

var ex2=`println("Hello World") # Affiche un message avec saut de ligne à la fin

def unefonction(unparametre):
   print("Le parametre est ", unparametre, " et son carré est ", unparametre*unparametre)
   println()
   
unefonction(12)

Sommet A
Sommet B
Arc (A,B)
Arc (A,C)
# Pour un graphe non orienté, la syntaxe est Arete [A,B]

print("Liste des sommets : ")
# sommets() est la liste des sommets du graphe
for x in sommets(): print(x, " ")
println()

print("Liste des arcs : ")
# arcs() est la liste des arcs du graphe
# particularité du langage, un arcs est une paire (a,b) et doit donc être stocké dans une "variable"
# qui est une paire. Ici, cette boucle for définit donc à chaque itération 3 objets différents
# x, un sommet, y, un autre sommet, et (x,y) un arc.
for (x,y) in arcs(): print((x,y), " ")
println()

# Les arcs et les sommets peuvent avoir des attributs si vous leur en donnez
A.unpremierattribut="coucou"
(A,B).unattribut=10
(A,C).unattribut=20

# La fonction "random", utilisée avec une liste en paramètre, retourne un élément au hasard de cette liste
println("Un sommet au hasard : ", random(sommets()))
println("Un sommet au hasard : ", random(sommets()))
println("Un sommet au hasard : ", random(sommets()))
println("Un sommet au hasard : ", random(sommets()))
println("Un sommet au hasard : ", random(sommets()))
println("Un sommet au hasard : ", random(sommets()))

print("10 arcs au hasard : ")
for i in range(0, 10):
   print(random(arcs()))
println()

# La fonction random accepte un 2e paramètre, qui est une condition de filtrage
print("10 arcs au hasard, parmis ceux avec unatribut>15 :")
for i in range(0,10):
   print(random(arcs(), unattribut>15))
println()
`;

var fromls=localStorage.getItem("laborop_code");
if(fromls) ex2=fromls;
