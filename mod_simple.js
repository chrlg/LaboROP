for(let s in _grapheEnv) delete _grapheEnv[s];

_grapheEnv.S={t:"Sommet", name:"S", marques:{}};
_grapheEnv.A={t:"Sommet", name:"A", marques:{}};
_grapheEnv.B={t:"Sommet", name:"B", marques:{}};
_grapheEnv.P={t:"Sommet", name:"P", marques:{}};
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
