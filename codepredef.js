// Solution du labo 2
_sols=[];
_sols.push({version:3, name:"Labo2 - solu prof", code:`
# Création des sommets
# Pour chaque combinaison possible de quadruplet (passeur, femme, mari, amant)
# on crée un sommet. Si toutefois il est légal
for passeur in range(0,3):
   for femme in range(0,3):
      for mari in range(0,3):
         for amant in range(0,3):
            # Le mari et l'amant ne peuvent se trouver seuls ensemble
            if mari==amant and passeur!=amant and femme!=amant: continue
            # la femme et l'amant ne peuvent se trouver ensemble dans le passeur
            if femme==amant and passeur!=amant and mari!=amant: continue
            # La barque n'a qu'une place, en dehors de celle du passeur
            nb=0
            if femme==1: nb++
            if mari==1: nb++
            if amant==1: nb++
            if nb>1: continue
            # Personne ne peut se trouver dans la barque sans le passeur
            if nb>0 and passeur!=1: continue
            Sommet "S"+passeur+femme+mari+amant
# Juste pour bien voir où est le départ et l'arrivée (et tant qu'à faire vous montrer 
# une fonctionnalité graphique) on met en bleu dans le dessin les sommets S0000 et S2222
S0000.color="blue"
S2222.color="blue"


# Création des arcs
# Pour chaque paire de sommet possible, on crée un arc si le passage d'un sommet
# à l'autre est une possibilité élémentaire
# (élémentaire = on ne peut pas décomposer le passage de s1 à s2 en plusieurs plus petites
# étape : en d'autres termes, ce n'est pas à vous de vous demander s'il existe un chemin entre
# s1 et s2, mais à la machine. Vous vous vous contentez de décrire les arcs qui correspondents
# à toutes les étapes possibles d'un chemin)
for s1 in sommets():
   for s2 in sommets():
      dbg=False
      if s1==S1001 and s2==S2002: dbg=True
      ok=True # Sauf changement dans la suite, l'arc va être créé
      nbouge=0 # Nombre de personnes qui se sont déplacées, en dehors du passeur
      # Pour savoir si l'arc (s1,s2) correspondrait au mouvement d'une ou plusieurs
      # personnes, on va comparer le kième caractère du nom des sommets s1 et s2
      # puisque les caractères des noms des sommets sont la position des personnes dans
      # un état donné du monde
      # Le caractère s1[0] est un "S". Le caractère s1[1] est la position du passeur 
      # dans l'état s1. Le caractère s1[2], de la femme, s1[3] du mari, s1[4] de l'amant
      # idem pour s2
      for k in range(2,5): # Pour k valant 2,3,4
         if s1[k]!=s2[k]: # Oui, la personne k bouge entre s1 et s2
            nbouge++ # donc ça fait une personne de plus qui bouge
            # Si elle bouge, ça ne peut être qu'en passant par la barque (sinon on parle
            # d'une téléportation entre la rive droite et gauche)
            if s1[k]!="1" and s2[k]!="1": ok=False
            # Il n'y a pas le droit de bouger sans être accompagné par le passeur
            if s1[k]!=s1[1] or s2[k]!=s2[1]: ok=False
      if nbouge>1: ok=False # 1 seule personne (en plus du passeur peut bouger)
      # Le passeur doit obligatoirement être dans la barque au départ ou à l'arrivée (s1/s2)
      # mais pas les deux (sinon c'est qu'un mouvement a eu lieu sans lui)
      if !(s1[1]=="1" xor s2[1]=="1"): ok=False
      # La femme ne quitte pas la rive droite une fois qu'elle l'a atteinte (sinon, mal de mer)
      if s1[2]=="2" and s2[2]!="2": ok=False
      # Le mari ne quitte pas la rive droite une fois qu'il l'a atteinte (sinon la situation
      # va devenir encore plus compliquée qu'elle ne l'est déjà)
      if s1[3]=="2" and s2[3]!="2": ok=False
      # Sauf raison contraire, on crée donc l'arc
      if ok: Arc (s1,s2)

# Il ne nous reste plus qu'à utiliser ce graphe pour chercher l'existence d'une solution 
# (labo 2) et pour identifier cette solution (labo 3)

# Labo 2
println("La matrice d'adjacence est :")
print(Adj)
println()

nbOpAvantCalculMatriciel = OpCount # Pour comparer l'efficacité des algorithmes
println("Le calcul matriciel de la fermeture transitive donne :")
n=len(Id) # n=dimension de la matrice
F = (Adj .+ Id) .^ (n-1)
print(F)
nbOpApresCalculMatriciel = OpCount
println("Calcul effectué en ", nbOpApresCalculMatriciel-nbOpAvantCalculMatriciel, " opérations")
println()

println("L'algorithme de Warshall donne la matrice :")
C = Adj .+ Id
for k in range(n):
   for i in range(n):
      for j in range(n):
         C[i,j] = C[i,j] .+ C[i,k] .* C[k,j]
print(C)
println("Calcul effectué en ", OpCount-nbOpApresCalculMatriciel, " opérations")
println()


if C==F:
   println("On constate que les deux méthodes donnent le même résultat")
else:
   println("Il y a manifestement une erreur dans mon code")
`});

_sols.push({version:1, name:"Labo4 - solu prof", code:`
#france : 21->0
#29Ns : 4180->10428
#nord29 : Pas la peine c'est trop gros de toutes façons

import("29Ns")
depart=S4180
arrivee=S10428

# Algorithme de Ford
def ford(depart):
   # Tous les sommets sont marqués d(s)=∞ initialement
   for s in sommets(): s.d=Infinity # Oui, Infinity existe maintenant. Je triche, puisqu'il n'existait pas lors de votre labo
   depart.d=0 # Sauf le sommet de départ
   n=len(sommets()) # Nombre de sommets
   for i in range(n-1): # Comme dans le cours : on fait n-1 passages
      nch=0 # Optimisation: nombre de modifications faites (voir plus loin)
      for [u,v] in aretes(): # Pour toutes les arêtes
         if v.d>u.d+[u,v].val: # Si l'arête permet d'améliorer une marque d
            v.d=u.d+[u,v].val # alors on améliore la marque d
            v.pred=u # Et, histoire de pouvoir retrouver le chemin optimal (pas seulement sa longueur) on ajoute une marque pred sur le sommet dont on vient d'améliorer le chemin
            nch++ # On incrémente le compteur de trucs modifiés
         if u.d>v.d+[u,v].val: # Piège : puisque le graphe est non orienté, chaque arête peut
            u.d=v.d+[u,v].val # servir dans les deux sens. Il faut donc aussi envisager que
            u.pred=v # l'arête [u,v] permet d'améliorer la distance de u, en passant par v
            nch++
      #print(i, "[",nch,"] ") # Juste pour se rendre compte de l'avancement. Et se rendre compte à quel point on n'a aucune chance de finir vite sur une vraie carte avec Ford
      if nch==0: break # Optimisation : si on n'a rien fait, alors pas la peine d'attendre 
         # de faire n-1 passes, de toutes façons, toutes les passes qui suivent ne changeront
         # plus rien

# Algorithme de Dijkstra
def dijkstra(depart):
   for s in sommets(): s.d=Infinity
   depart.d=0
   nonMarqueNonInfini=[]+depart # Liste des sommets non marqués (en excluant ceux à distace infinie qui n'ont aucune chance d'être élus "plus proche sommet non marqué")
   while len(nonMarqueNonInfini)>0:
      #1. Recherche du plus petit dans cette liste
      idxMin=0
      for i in range(1, len(nonMarqueNonInfini)):
         # si le ième est plus petit que le idxMinième
         if nonMarqueNonInfini[i].d<nonMarqueNonInfini[idxMin].d:
            idxMin=i
      #2, maintenant idxMin est le sommet non marqué de distance la plus petite
      # Il ne reste plus qu'à regardé tous les successeurs possibles
      smin=pop(nonMarqueNonInfini, idxMin) # Je l'enlève de la liste (⇔ je le marque)
      for [x,y] in aretes(smin):
         if y.d>smin.d+[x,y].val:
            y.d=smin.d+[x,y].val
            y.pred=smin # Comme pour ford : ce qu'il faut pour retrouver le chemin quand on aura fini
            nonMarqueNonInfini += y # y est maintenant à traiter (sa distance n'est pas infinie). Notez que si ça se trouve, c'est pas la première fois : pas grave, au pire la 2e visite ne servira à rien (on pourrait aussi ajouter vraiment une marque aux sommets, en plus de les enlever/ajouter à ce tableau, pour éviter ça)
         # Note : pas besoin cette fois de traiter l'arête dans les deux sens : de toutes façons, smin, c'est ce qu'a démontré dijkstra, ne peut plus être amélioré. Il n'y a donc aucune chance que x.d>y.d+[x,y].val (rappel x=smin)

# Calcul du chemin à partir des marques "pred"
def chemin(depart, arrivee):
   # On part de la fin
   s=arrivee
   retour=""
   while s!=depart: # et tant qu'on n'est pas arrivé au départ
      retour = ""+s+"-"+retour
      s=s.pred # on remonte vers le prédécesseur (dans le chemin calculé) 
   retour = ""+depart+"-"+retour
   return retour

# Coloration en rouge
def rouge(depart, arrivee):
   # Fondamentalement le même algorithme
   s=arrivee
   while s!=depart:
      p=s.pred
      [p,s].color="red" # on colore l'arête (note : dans ce mode d'affichage, les sommes ne sont pas représentés de toutes façons)
      s=p

dijkstra(depart)
println(chemin(depart, arrivee))
rouge(depart, arrivee)

`});

_sols.push({name:"Labo1 - solu prof", version:1, code:`
# Création du graphe. Note : la création des sommets A,B,C,D est implicite
Arete [A,B]
Arete [A,B]
Arete [A,C]
Arete [A,C]
Arete [A,D]
Arete [B,D]
Arete [C,D]

# Fonction qui réalise un parcours, en partant d'un sommet choisi au hasard,
# et en empruntant des ponts choisis au hasard, jusqu'à ce que ça ne soit plus
# possible
def unparcours():
   nponts=0 # on n'a franchi aucun pont encore
   for a in aretes(): a.dejafranchi=False # idem
   position=random(sommets()) # Notre position est un des 4 sommets
   while True:
      [a,b] = random(aretes(position), dejafranchi==False) # Une arete sortante du sommet 
      if b==null: return nponts # Il n'y avait aucune arete non franchies => fin
      [a,b].dejafranchi=True # Maintenant on a franchi ce pont là
      nponts++ # Et ça fait un pont de plus de franchi
      position=b # L'autre côté du pont devient notre nouvelle position

nmax=0
for i in range(1000): # On fait 1000 essais
   n=unparcours() # nombre de pont franchi lors de cet essai
   print(n)
   if n>nmax: nmax=n # calcul du max

println()
println("Meilleur essai : ", nmax)
`});

_sols.push({name:"Labo3 - solu prof", version:1, code:`
# Création des sommets
# Pour chaque combinaison possible de quadruplet (passeur, femme, mari, amant)
# on crée un sommet. Si toutefois il est légal
for passeur in range(0,3):
   for femme in range(0,3):
      for mari in range(0,3):
         for amant in range(0,3):
            # Le mari et l'amant ne peuvent se trouver seuls ensemble
            if mari==amant and passeur!=amant and femme!=amant: continue
            # la femme et l'amant ne peuvent se trouver ensemble dans le passeur
            if femme==amant and passeur!=amant and mari!=amant: continue
            # La barque n'a qu'une place, en dehors de celle du passeur
            nb=0
            if femme==1: nb++
            if mari==1: nb++
            if amant==1: nb++
            if nb>1: continue
            # Personne ne peut se trouver dans la barque sans le passeur
            if nb>0 and passeur!=1: continue
            Sommet "S"+passeur+femme+mari+amant
# Juste pour bien voir où est le départ et l'arrivée (et tant qu'à faire vous montrer 
# une fonctionnalité graphique) on met en bleu dans le dessin les sommets S0000 et S2222
S0000.color="blue"
S2222.color="blue"


# Création des arcs
# Pour chaque paire de sommet possible, on crée un arc si le passage d'un sommet
# à l'autre est une possibilité élémentaire
# (élémentaire = on ne peut pas décomposer le passage de s1 à s2 en plusieurs plus petites
# étape : en d'autres termes, ce n'est pas à vous de vous demander s'il existe un chemin entre
# s1 et s2, mais à la machine. Vous vous vous contentez de décrire les arcs qui correspondents
# à toutes les étapes possibles d'un chemin)
for s1 in sommets():
   for s2 in sommets():
      dbg=False
      if s1==S1001 and s2==S2002: dbg=True
      ok=True # Sauf changement dans la suite, l'arc va être créé
      nbouge=0 # Nombre de personnes qui se sont déplacées, en dehors du passeur
      # Pour savoir si l'arc (s1,s2) correspondrait au mouvement d'une ou plusieurs
      # personnes, on va comparer le kième caractère du nom des sommets s1 et s2
      # puisque les caractères des noms des sommets sont la position des personnes dans
      # un état donné du monde
      # Le caractère s1[0] est un "S". Le caractère s1[1] est la position du passeur 
      # dans l'état s1. Le caractère s1[2], de la femme, s1[3] du mari, s1[4] de l'amant
      # idem pour s2
      for k in range(2,5): # Pour k valant 2,3,4
         if s1[k]!=s2[k]: # Oui, la personne k bouge entre s1 et s2
            nbouge++ # donc ça fait une personne de plus qui bouge
            # Si elle bouge, ça ne peut être qu'en passant par la barque (sinon on parle
            # d'une téléportation entre la rive droite et gauche)
            if s1[k]!="1" and s2[k]!="1": ok=False
            # Il n'y a pas le droit de bouger sans être accompagné par le passeur
            if s1[k]!=s1[1] or s2[k]!=s2[1]: ok=False
      if nbouge>1: ok=False # 1 seule personne (en plus du passeur peut bouger)
      # Le passeur doit obligatoirement être dans la barque au départ ou à l'arrivée (s1/s2)
      # mais pas les deux (sinon c'est qu'un mouvement a eu lieu sans lui)
      if !(s1[1]=="1" xor s2[1]=="1"): ok=False
      # La femme ne quitte pas la rive droite une fois qu'elle l'a atteinte (sinon, mal de mer)
      if s1[2]=="2" and s2[2]!="2": ok=False
      # Le mari ne quitte pas la rive droite une fois qu'il l'a atteinte (sinon la situation
      # va devenir encore plus compliquée qu'elle ne l'est déjà)
      if s1[3]=="2" and s2[3]!="2": ok=False
      # Sauf raison contraire, on crée donc l'arc
      if ok: Arc (s1,s2)

# Il ne nous reste plus qu'à utiliser ce graphe pour chercher l'existence d'une solution 
# (labo 2) et pour identifier cette solution (labo 3)

# Labo 2
n=len(Id) # n=dimension de la matrice
def calculMatriciel():
   println("La matrice d'adjacence est :")
   print(Adj)
   println()
   
   nbOpAvantCalculMatriciel = OpCount # Pour comparer l'efficacité des algorithmes
   println("Le calcul matriciel de la fermeture transitive donne :")
   F = (Adj .+ Id) .^ (n-1)
   print(F)
   nbOpApresCalculMatriciel = OpCount
   println("Calcul effectué en ", nbOpApresCalculMatriciel-nbOpAvantCalculMatriciel, " opérations")
   println()
   
   println("L'algorithme de Warshall donne la matrice :")
   C = Adj .+ Id
   for k in range(n):
      for i in range(n):
         for j in range(n):
            C[i,j] = C[i,j] .+ C[i,k] .* C[k,j]
   print(C)
   println("Calcul effectué en ", OpCount-nbOpApresCalculMatriciel, " opérations")
   println()

   if C==F:
      println("On constate que les deux méthodes donnent le même résultat")
   else:
      println("Il y a manifestement une erreur dans mon code")


# Parcours en profondeur (version récursive)
# Juste l'algo du cours
for s in sommets(): s.marque=False
def profondeur(s):
   if s.marque: return # Sommet déjà marqué, on ne fait rien
   s.marque=True # Sinon, on le marque maintenant
   for (x,y) in arcs(s):
      if !y.marque: y.e=(x,y)
      profondeur(y)

profondeur(S0000)
println(S2222.e)
S2222.e.color="red"
S1221.e.color="red"
S0220.e.color="red"








# Parcours en largeur
def largeur(s):
   atraiter=[]
   atraiter += s # Initialement seul le sommet de départ est à traiter
   s.marque=True # et est marqué
   while len(atraiter)>0: # Tant qu'il y a des sommets à traiter
      sat=atraiter[0] # "Sommet-A-Traiter" aka sat est le premier sommet dans l'ordre d'ajout
      atraiter = atraiter[1:] # On prive atraiter de ce premier sommet
      for (x,y) in arcs(sat): # Et on y ajoute tous les successeurs
         if !y.marque: # Du moins les successeurs pas déjà marqués
            atraiter += y 
            y.marque=True
            y.entree = (x,y) # Modif pour garder trace du chemin 

# Parcours en profondeur, mais version non récursive
# Très exactement la même chose qu'en largeur. Sauf qu'on traite et retire le dernier
# élément de la liste des sommets à traiter au lieu du premier
def profondeurListe(s):
   atraiter=[]
   atraiter += s
   s.marque=True
   while len(atraiter)>0:
      sat=atraiter[len(atraiter)-1]
      atraiter = atraiter[:len(atraiter)-1]
      for (x,y) in arcs(sat):
         if !y.marque:
            atraiter += y
            y.marque=True
            y.entree = (x,y)
            
# Warshall modifié
# Juste pour le fun : Après tout, la même modif peut-être appliquée à Warshall
# (et même à un calcul matriciel si on voulait). Dans le même esprit que la modif faites
# aux algos profodeur largeur : en plus de "marquer" un sommet (ici mettre C[i,j] à 1)
# on retient quelque part la raison pour laquelle on l'a marqué
# Dans les aglos profondeur, largeur, c'était le champ "entree" qui nous disait
# "j'ai marqué ce sommet, parce que l'arc entree=(x,y) était tel que x était marqué"
# (en d'autres termes, j'ai dit que "y" était accessible, parce que x l'était et que 
# l'arc (x,y) existait")
# Ici, c'est le tableaux de chaines "chemin" qui fait le job : 
# à chaque fois qu'on passe un C[i,j] de 0 à 1, on note au passage que si C[i,j] est 1,
# cad s'il existe un chemin entre i et j, c'est parce qu'il existe un chemin 
# entre i et k et un autre entre k et j. Ce chemin est donc la concaténation des deux
# Notez que les parcours profondeur/largeur ne donnent que les chemins depuis le sommet
# de départ vers un sommet donné. Ici, donc, que les chemins entre S0000 et x, qqsoit x.
# Ce "Warshall" donne tous les chemins entre x et y, qqsoit x et y
def warshallCh():
   chemins=[]
   C = Adj .+ Id
   for i in range(n):
      for j in range(n):
         if C[i,j]==1:
            chemins[i][j] = "(" + sommets(i) +"," + sommets(j) + ")"
         else:
            chemins[i][j] = ""
   for k in range(n):
      for i in range(n):
         for j in range(n):
            if C[i,j]==0 and C[i,k]*C[k,j]==1:
               C[i,j]=1
               chemins[i][j] = chemins[i][k]+chemins[k][j]
   println("Warshall donne : ", chemins[0][23])


#warshallCh()

# Affichage de la solution (dans le graphe) ; à n'appeler qu'après avoir appelé
# un parcours qui remplit correctement les attributs "entree"
# La méthode consiste à parcourir à l'envers ce chemin, en partant de la fin
# s=S2222. (x,y)=s.entree est l'arc qui a permis, dans le chemin d'accéder à s
# Donc x.entree=(x',y') est lui même l'arc qui a permis d'accéder à x, 
# le prédécesseur de s dans le chemin
# Donc x'.entree=(x'', y'') est lui même l'arc qui a permis d'accéder à x'
# le prédécesseur du prédécesseur de s dans le chmin)
# etc, jusqu'au point de départ
#largeur(S0000)
def cheminRouge():
   s=S2222
   while s!=S0000:
      s.color="red"
      (x,y)=s.entree
      (x,y).color="red"
      s=x
      
def chaineChemin():
   str="S2222"
   s=S2222
   while s!=S0000:
      (x,y)=s.entree
      str = ""+x+"-"+str
      s=x
   return str

#println("Le chemin est : ", chaineChemin())
#cheminRouge()
`});
