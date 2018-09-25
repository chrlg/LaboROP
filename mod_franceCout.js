function ajsommet(name, x, y){
   let xx={t:"number", val:x};
   let yy={t:"number", val:y};
   let ns={t:"Sommet", name:name, marques:{x:xx, y:yy}};
   _grapheEnv[name]=ns;
}

function ajarc(n1, n2, d, cap){
   let s1=_grapheEnv[n1];
   let s2=_grapheEnv[n2];
   let dd={t:"number", val:d};
   let cc={t:"number", val:cap*34.2};
   let ff={t:"number", val:0};
   let na={t:"Arc", i:s1, a:s2, marques:{val:dd, capacite:cc, flux:ff}};
   _arcs.push(na);
}
ajsommet('P',834.607784,921.228333);
ajsommet('V1',741.101772,985.453979);
ajsommet('V2',660.841023,872.83313);
ajsommet('V3',531.952371,979.003906);
ajsommet('V4',415.191744,886.878784);
ajsommet('V5',208.804896,945.738708);
ajsommet('V6',662.781956,692.309937);
ajsommet('V7',538.513555,691.034119);
ajsommet('V8',278.101604,795.322327);
ajsommet('V9',677.334377,519.3797);
ajsommet('V10',869.461315,379.542725);
ajsommet('V11',605.6204,304.542023);
ajsommet('V12',487.588171,107.363998);
ajsommet('V13',368.052782,511.453888);
ajsommet('V14',485.930609,349.169983);
ajsommet('V15',286.490965,630.280151);
ajsommet('V16',333.678629,443.792511);
ajsommet('V17',397.645156,284.011108);
ajsommet('V18',201.293026,431.667969);
ajsommet('V19',209.483368,531.663452);
ajsommet('V20',28.540947,444.404785);
ajsommet('S',0.770719,401.405762);
ajarc('V1','P',150,7);
ajarc('V2','V1',181,7);
ajarc('V3','V2',193,3);
ajarc('V4','V3',206,2);
ajarc('V5','V4',320,1);
ajarc('V6','V2',202,4);
ajarc('V7','V3',372,1);
ajarc('V7','V6',178,1);
ajarc('V8','V7',368,1);
ajarc('V8','V5',204,1);
ajarc('V8','V4',218,1);
ajarc('V9','V6',194,3);
ajarc('V10','V9',333,1);
ajarc('V11','V9',308,1);
ajarc('V11','V10',347,1);
ajarc('V12','V11',279,1);
ajarc('V13','V14',238,1);
ajarc('V14','V7',422,1);
ajarc('V14','V9',313,1);
ajarc('V14','V11',143,1);
ajarc('V14','V12',298,1);
ajarc('V15','V8',187,2);
ajarc('V13','V15',173,1);
ajarc('V16','V14',195,1);
ajarc('V16','V13',98,1);
ajarc('V17','V12',254,1);
ajarc('V17','V14',135,1);
ajarc('V18','V17',312,2);
ajarc('V18','V16',157,1);
ajarc('V19','V13',212,1);
ajarc('V19','V16',183,1);
ajarc('V19','V15',144,1);
ajarc('V18','V19',107,1);
ajarc('V20','V19',231,2);
ajarc('S','V18',243,4);
ajarc('S','V20',71,2);
_predefEnv.Oriente=TRUE;
_grapheChange=true;
_grapheMode="map";
