for(let s in _grapheEnv) delete _grapheEnv[s];

_grapheEnv.S={t:"Sommet", name:"S", marques:{}};
_grapheEnv.A={t:"Sommet", name:"A", marques:{}};
_grapheEnv.B={t:"Sommet", name:"B", marques:{}};
_grapheEnv.P={t:"Sommet", name:"P", marques:{}};
function ajoutArc(init, term, cap, f){
   _arcs.push({t:"Arc", i:_grapheEnv[init], a:_grapheEnv[term], marques:{capacite:{t:"number", val:cap}, flux:{t:"number", val:f}}});
}
ajoutArc("S", "A", 20, 0);
ajoutArc("S", "B", 20, 20);
ajoutArc("A", "B", 20, 0);
ajoutArc("A", "P", 10, 0);
ajoutArc("B", "P", 20, 20);
_env.setOrient(TRUE);
_grapheChange=true;
