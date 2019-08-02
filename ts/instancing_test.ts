THREE.ShaderLib.lambert = { // this is a cut-and-paste of the lambert shader -- modified to accommodate instancing for this app
    uniforms: THREE.ShaderLib.lambert.uniforms,
    vertexShader:
        `
        attribute vec4 aInstanceMatrix0;
        attribute vec4 aInstanceMatrix1;
        attribute vec4 aInstanceMatrix2;
        attribute vec4 aInstanceMatrix3;

        attribute vec3 aInstanceColor;
        attribute vec3 aInstanceEmissive;

        varying vec3 vInstanceColor;
        varying vec3 vInstanceEmissive;

        #define LAMBERT
        #ifdef INSTANCED
            attribute vec3 instanceOffset;
            attribute vec3 instanceColor;
            attribute float instanceScale;
        #endif
        varying vec3 vLightFront;
        varying vec3 vIndirectFront;
        #ifdef DOUBLE_SIDED
            varying vec3 vLightBack;
            varying vec3 vIndirectBack;
        #endif
        #include <common>
        #include <uv_pars_vertex>
        #include <uv2_pars_vertex>
        #include <envmap_pars_vertex>
        #include <bsdfs>
        #include <lights_pars_begin>
        #include <color_pars_vertex>
        #include <fog_pars_vertex>
        #include <morphtarget_pars_vertex>
        #include <skinning_pars_vertex>
        #include <shadowmap_pars_vertex>
        #include <logdepthbuf_pars_vertex>
        #include <clipping_planes_pars_vertex>
        void main() {
            #include <uv_vertex>
            #include <uv2_vertex>
            #include <color_vertex>
           vInstanceColor = aInstanceColor;
           vInstanceEmissive = aInstanceEmissive;
            // vertex colors instanced
            #ifdef INSTANCED
                #ifdef USE_COLOR
                    vColor.xyz = instanceColor.xyz;
                #endif
            #endif
            mat4 _aInstanceMatrix = mat4(
                aInstanceMatrix0,
                aInstanceMatrix1,
                aInstanceMatrix2,
                aInstanceMatrix3
              );
              vec3 objectNormal = (_aInstanceMatrix * vec4( normal, 0. ) ).xyz;
            #include <morphnormal_vertex>
            #include <skinbase_vertex>
            #include <skinnormal_vertex>
            #include <defaultnormal_vertex>
            mat4 aInstanceMatrix = mat4(
                aInstanceMatrix0,
                aInstanceMatrix1,
                aInstanceMatrix2,
                aInstanceMatrix3
            );
            vec3 transformed = (aInstanceMatrix * vec4( position , 1. )).xyz;
            // position instanced
            #ifdef INSTANCED
                transformed *= instanceScale;
                transformed = transformed + instanceOffset;
            #endif
            #include <morphtarget_vertex>
            #include <skinning_vertex>
            #include <project_vertex>
            #include <logdepthbuf_vertex>
            #include <clipping_planes_vertex>
            #include <worldpos_vertex>
            #include <envmap_vertex>
            #include <lights_lambert_vertex>
            #include <shadowmap_vertex>
            #include <fog_vertex>
        }
        `,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader
};

function render() {
    console.log(renderer.info.render.calls)
    renderer.render(scene, camera);
}

// animation cycle and control updates
function animate() {
    requestAnimationFrame(animate);
    controls.update();
}

//Fix Resize problems
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    controls.handleResize();

    render();

}

//Setup the scene and renderer and camera 
var scene = new THREE.Scene();
//scene.background = new THREE.Color(0x000000);

var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); //create camera

// set camera position 
camera.position.x = 100;

var lights: THREE.PointLight[] = [];
lights[0] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[0].position.set(0, 0, -200);
lights[1] = new THREE.PointLight(0xffffff, 0.85, 0);
lights[1].position.set(94, 163, 67);
scene.add(lights[0]);
scene.add(lights[1]);

var canvas = <HTMLCanvasElement> document.getElementById("threeCanvas");
var renderer = new THREE.WebGLRenderer({ //create renderer
    preserveDrawingBuffer: true,
    alpha: true,
    antialias: true,
    canvas: canvas
});

renderer.setSize(window.innerWidth, window.innerHeight); //set size of renderer - where actions are recognized
document.body.appendChild(renderer.domElement); //add renderer to document body

var controls = new THREE.TrackballControls(camera, canvas);
controls.rotateSpeed = 1.5;
controls.zoomSpeed = 1.5;
controls.panSpeed = 1.0;
controls.noZoom = false;
controls.noPan = false;
controls.staticMoving = true;
controls.dynamicDampingFactor = 0.2;
controls.keys = [65, 83, 68];
// following the logic of updating the scene only when the scene changes 
// controlls induce change so we update the scene when we move it  
controls.addEventListener('change', render);

animate();

var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);

//setup for instancing
var backbone_geometry = new THREE.SphereBufferGeometry(.2,10,10);
var instanced_backbone = new THREE.InstancedBufferGeometry();
window['instanced_backbone'] = instanced_backbone;
Object.keys(backbone_geometry.attributes).forEach(attributeName=>{
    instanced_backbone.attributes[attributeName] = backbone_geometry.attributes[attributeName]
})
instanced_backbone.index = backbone_geometry.index;
        
var intersectsScene = new THREE.Scene();

target.addEventListener("drop", function (event) {

    // cancel default actions
    event.preventDefault();
    var file = event.dataTransfer.files[0];

    var dat_reader = new FileReader()
    dat_reader.readAsText(file);

    dat_reader.onload = () => {


        let lines = dat_reader.result.split(/[\n]+/g);
        let num_nuc = lines.length;
        lines = lines.slice(3);


        //set up the instancing with the number of particles
        instanced_backbone.maxInstancedCount = num_nuc;
        const arraySize = num_nuc*4;
        console.log(arraySize);
        var matrixArray = [
            new Float32Array(arraySize),
            new Float32Array(arraySize),
            new Float32Array(arraySize),
            new Float32Array(arraySize)
        ]
        var attributeArray = []
        for (let i = 0; i < matrixArray.length; i++) {
            const attribute = new THREE.InstancedBufferAttribute(matrixArray[i], 4)
            attribute.dynamic = true

            attributeArray.push(attribute)
            instanced_backbone.addAttribute(
                `aInstanceMatrix${i}`,
                new THREE.InstancedBufferAttribute(matrixArray[i], 4)
            )
        }
        const instanceColorArray = new Uint8Array(num_nuc * 3);
        instanced_backbone.addAttribute(
            'aInstanceColor',
            new THREE.InstancedBufferAttribute(instanceColorArray, 3, 1)
        );

        const instanceEmissiveArray = new Uint8Array(num_nuc * 3)
        var instanceEmissive = new THREE.InstancedBufferAttribute(instanceEmissiveArray, 3, 1)
        instanced_backbone.addAttribute(
            'aInstanceEmissive',
            instanceEmissive
        )

        for (let i = 0; i < num_nuc; i++) {
            if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
                break
            };
            let l: string = lines[i].split(" ");
            let x = parseFloat(l[0]),// - fx,
            y = parseFloat(l[1]),// - fy,
            z = parseFloat(l[2]);
            var backbone = new THREE.Object3D()
            const backbone_color = new THREE.Color(0xff0000)
            backbone.position.set(x, y, z );
            intersectsScene.add(backbone);
            backbone.updateMatrixWorld(true);

            //scene.add(current_nucleotide.visual_object.children[current_nucleotide.BACKBONE]);
            for ( let r = 0 ; r < 4 ; r ++ )
                for ( let c = 0 ; c < 4 ; c ++ ){
                    matrixArray[r][i*4 + c] = backbone.matrixWorld.elements[r*4 + c];
            }
            const colorArray = backbone_color.toArray().map(col=>Math.floor(col*255))
            backbone.userData.color = colorArray;
            for( let c = 0 ; c < 3 ; c ++ ){
                instanceColorArray[i*3+c] = colorArray[c];
            }
        }
        intersectsScene.updateMatrixWorld(true);
        const instanceMaterial = new THREE.MeshLambertMaterial();
        instanceMaterial.onBeforeCompile = shader=>{
            shader.fragmentShader = `
        varying vec3 vInstanceColor;
        ${
                shader.fragmentShader.replace(
                    'vec4 diffuseColor = vec4( diffuse, opacity );',
                    'vec4 diffuseColor = vec4( vInstanceColor, opacity );'
                )}
        `

            shader.fragmentShader = `
        varying vec3 vInstanceEmissive;
        ${
                shader.fragmentShader.replace(
                    'vec3 totalEmissiveRadiance = emissive;',
                    'vec3 totalEmissiveRadiance = vInstanceEmissive;'
                )}
        `
        }

        scene.add(new THREE.Mesh(
            instanced_backbone,
            instanceMaterial
        ))
        render();
    };
    
}, false);
    