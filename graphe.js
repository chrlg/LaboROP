// Chaque graphe de Graphes a la structure suivante :
// * name : le nom du graphe. Le graphe par défaut s'appelle G
// * sommets : la liste des sommets. Celle de G constitue par ailleurs un environnement en soi
// * arcs : la liste des arcs
// * mode : le mode d'affichage. "dot" par défaut, pour G. "dot"=rendu avec GraphViz. "map"=rendu des arcs seulement
// * change : true si le graphe a changé depuis la dernière fois qu'il a été affiché
// * oriente : true si le graphe est orienté, false s'il ne l'est pas, undefined si on n'a pas encore décidé
class Graphe {
   constructor(name){
      this.name = name;
      this.sommets = {};
      this.arcs = [];
      this.mode = "dot";
      this.change = false;
      this.oriente = UNDEFINED;
   }

   function isOrient(){
      return this.oriente.val;
   }
   function setOrient(o){
      this.oriente.val = o;
   }
}

