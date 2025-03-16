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

## Rezultati

![alt text](demo/nike1.png)
![alt text](demo/nike2.png)
![alt text](demo/train1.png)
![alt text](demo/train2.png)
![alt text](demo/plush.png)



