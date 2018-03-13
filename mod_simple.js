_grapheEnv={"S":{t:"Sommet", name:"S", marques:{}}, "A":{t:"Sommet", name:"A", marques:{}}, "B":{t:"Sommet", name:"B", marques:{}}, "P":{t:"Sommet", name:"P", marques:{}}};
function ajoutArc(init, term, cap){
   _arcs.push({t:"Arc", i:_grapheEnv[init], a:_grapheEnv[term], marques:{capacite:{t:"number", val:cap}, label:{t:"string", val:""+cap}}});
}
ajoutArc("S", "A", 20);
ajoutArc("S", "B", 20);
ajoutArc("A", "B", 20);
ajoutArc("A", "P", 10);
ajoutArc("B", "P", 20);
_predefEnv.Oriente=TRUE;
_grapheChange=true;
