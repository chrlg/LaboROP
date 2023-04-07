 
// Les environnements
// Il y a 4 environnements globaux: predef qui contient les constantes et fonctions fournies
// Graphes, qui contient les graphes, désignés par leurs noms
// Graphes.G.sommets qui contient les sommets du graph principal désignés par leurs noms
// global, qui contient les variables globales et fonctions définies par l'utilisateur
// Et 1 environnement local, qui est créé à chaque appel de fonction
// Par défaut, l'envionnement local est l'environnement global. 
class Environnement {
   constructor(){
      // Environnement prédéfini. Contient les fonctions prédéfinies (random, print, ...)
      // Il est interdit de les écraser
      this.Predef = {}; 
      // Les Graphes. Dont le graphe par défaut, G
      this.Graphes = {};
      // Les variables globales
      this.Global = {};
      this.LocalEnvStack = [];
   }

   // Méthode utilitaire : accèse à la variable "Oriente" de l'environnement
   // prédéfini, disant si un grave est orienté ou non
   isOrient(){
      if(this.Predef.Oriente===undefined) return undefined;
      else return this.Predef.Oriente.val;
   }
   setOrient(v){
      this.Predef["Oriente"]=v;
   }
   getPredef(name){
      return this.Predef[name];
   }
}

