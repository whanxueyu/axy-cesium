export class CustomPrimitive {
    constructor(options) {
        this.commandType = options.commandType;

        this.geometry = options.geometry;
        this.attributeLocations = options.attributeLocations;
        this.primitiveType = options.primitiveType;

        this.uniformMap = options.uniformMap;

        this.vertexShaderSource = options.vertexShaderSource;
        this.fragmentShaderSource = options.fragmentShaderSource;

        this.rawRenderState = options.rawRenderState;
        this.framebuffer = options.framebuffer;

        this.outputTexture = options.outputTexture;

        this.autoClear = Cesium.defaultValue(options.autoClear, false);
        this.preExecute = options.preExecute;
        this.matrix = Cesium.defaultValue(options.matrix, Cesium.Matrix4.IDENTITY);

        this.show = true;
        this.commandToExecute = undefined;
        this.clearCommand = undefined;
        if (this.autoClear) {
            this.clearCommand = new Cesium.ClearCommand({
                color: new Cesium.Color(0.0, 0.0, 0.0, 0.0),
                depth: 1.0,
                framebuffer: this.framebuffer,
                pass: Cesium.Pass.OPAQUE
            });
        }
    }

    createCommand(context) {
        switch (this.commandType) {
            case 'Draw': {

                const attributeLocations = this.attributeLocations ? this.attributeLocations : Cesium.GeometryPipeline.createAttributeLocations(this.geometry)
                var vertexArray = Cesium.VertexArray.fromGeometry({
                    context: context,
                    geometry: this.geometry,
                    // attributeLocations: this.attributeLocations,
                    attributeLocations,
                    bufferUsage: Cesium.BufferUsage.STATIC_DRAW,
                });

                var shaderProgram = Cesium.ShaderProgram.fromCache({
                    context: context,
                    attributeLocations: attributeLocations,
                    vertexShaderSource: this.vertexShaderSource,
                    fragmentShaderSource: this.fragmentShaderSource
                });

                // const positionBuffer = Cesium.Buffer.createVertexBuffer({
                //     usage: Cesium.BufferUsage.STATIC_DRAW,
                //     // typedArray: new Float32Array([
                //     //     10000, 50000, 300,
                //     //     -20000, -10000, 300,
                //     //     50000, -30000, 300,
                //     // ]),
                //     typedArray: this.geometry.attributes.position.values,
                //     context: context,
                // })
                // console.log(this.geometry)
                // const vertexArray2 = new Cesium.VertexArray({
                //     context: context,
                //     attributes: [{
                //         index: 0, // 等于 attributeLocations['position']
                //         vertexBuffer: positionBuffer,
                //         componentsPerAttribute: 3,
                //         componentDatatype: Cesium.ComponentDatatype.FLOAT
                //     },
                //         {
                //             index: 1, // 等于 attributeLocations['st']
                //             vertexBuffer: Cesium.Buffer.createVertexBuffer({
                //                 usage: Cesium.BufferUsage.STATIC_DRAW,
                //                 // typedArray: new Float32Array([
                //                 //     0., 0.,
                //                 //     1.,0.,
                //                 //     0.5, 1.,
                //                 // ]),
                //                 typedArray: this.geometry.attributes.st.values,
                //                 context: context,
                //             }),
                //             componentsPerAttribute: 2,
                //             componentDatatype: Cesium.ComponentDatatype.FLOAT
                //         },
                //         {
                //             index: 2, // 等于 attributeLocations['normal']
                //             vertexBuffer: Cesium.Buffer.createVertexBuffer({
                //                 usage: Cesium.BufferUsage.STATIC_DRAW,
                //                 // typedArray: new Float32Array([
                //                 //     0., 0., 1.,
                //                 //     0., 0., 1.,
                //                 //     0., 0., 1.,
                //                 // ]),
                //                 typedArray: this.geometry.attributes.normal.values,
                //                 context: context,
                //             }),
                //             componentsPerAttribute: 3,
                //             componentDatatype: Cesium.ComponentDatatype.FLOAT
                //         },
                //     ],
                //
                //     indices: this.geometry.indices
                // })

                var renderState = Cesium.RenderState.fromCache(this.rawRenderState);
                return new Cesium.DrawCommand({
                    owner: this,
                    vertexArray: vertexArray,
                    primitiveType: this.primitiveType,
                    uniformMap: this.uniformMap,
                    modelMatrix: this.matrix,
                    shaderProgram: shaderProgram,
                    framebuffer: this.framebuffer,
                    renderState: renderState,
                    pass: Cesium.Pass.OPAQUE
                });
            }
            case 'Compute': {
                return new Cesium.ComputeCommand({
                    owner: this,
                    fragmentShaderSource: this.fragmentShaderSource,
                    uniformMap: this.uniformMap,
                    outputTexture: this.outputTexture,
                    persists: true
                });
            }
        }
    }

    setGeometry(context, geometry) {
        this.geometry = geometry;
        var vertexArray = Cesium.VertexArray.fromGeometry({
            context: context,
            geometry: this.geometry,
            attributeLocations: this.attributeLocations,
            bufferUsage: Cesium.BufferUsage.STATIC_DRAW,
        });
        this.commandToExecute.vertexArray = vertexArray;
    }

    update(frameState) {
        if (!this.show) {
            return;
        }

        // console.log(frameState.frameNumber)

        if (!Cesium.defined(this.commandToExecute)) {
            this.commandToExecute = this.createCommand(frameState.context);
        }

        if (Cesium.defined(this.preExecute)) {
            this.preExecute();
        }

        if (Cesium.defined(this.clearCommand)) {
            frameState.commandList.push(this.clearCommand);
        }
        frameState.commandList.push(this.commandToExecute);
    }

    isDestroyed() {
        return false;
    }

    destroy() {
        if (Cesium.defined(this.commandToExecute)) {
            this.commandToExecute.shaderProgram = this.commandToExecute.shaderProgram && this.commandToExecute.shaderProgram.destroy();
        }
        return Cesium.destroyObject(this);
    }
}
