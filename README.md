# GaussianSplatting

Gaussian splatting implementiran z WebGPU in TypeScript.

Zahteve: node.js

Poženeš z: 
`npm install`
`npm start`

Sortiranje je implementirano na procesorju in porabi ~90ms, točke se sortirajo, ko se kamera premakne za več kot določen threshold. 
S sortiranjem ob vsaki sliki smo tako na ~11 FPS. Ko kamere ne premikamo, upodabljanje brez problema stoji na 240 FPS, kar je frekvenca osveževanja zaslona. 

Specifikacije: 

CPU: 7800X3D

GPU: NVIDIA 4080 Super

Slike so v mapi demo




