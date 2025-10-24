export default class RFLinkBudget {
    constructor() {
        // 输入参数
        this.txPower = 0; // 发射功率(dBm)
        this.txAntennaGain = 0; // 发射天线增益(dBi)
        this.rxAntennaGain = 0; // 接收天线增益(dBi)
        this.frequencyMHz = 0; // 工作频率(MHz)
        this.txCableLoss = 0; // 发射端电缆损耗(dB)
        this.rxCableLoss = 0; // 接收端电缆损耗(dB)
        this.rxSensitivity = 0; // 接收灵敏度(dBm)
        this.fadeMargin = 0; // 衰减余量(dB)

        // 输出参数
        this.fspl = 0; // 自由空间路径损耗(dB)
        this.maxDistanceKM = 0; // 最大通信距离(km)
    }

    // 计算自由空间路径损耗
    calculateFSPL() {
        this.fspl = 32.45 + 20 * Math.log10(this.frequencyMHz) + 20 * Math.log10(this.maxDistanceKM);
        return this.fspl;
    }

    // 计算最大通信距离
    calculateMaxDistance() {
        // 计算指数部分
        const exponent = (this.txPower + this.txAntennaGain - this.txCableLoss + 
            this.rxAntennaGain - this.rxCableLoss - this.rxSensitivity - this.fadeMargin - 32.45) / 
            (20 * Math.log10(this.frequencyMHz));

        // 计算最大距离
        this.maxDistanceKM = Math.pow(10, exponent);

        return this.maxDistanceKM;
    }

    // 设置参数
    setParameters(params) {
        for (const key in params) {
            if (params.hasOwnProperty(key)) {
                this[key] = params[key];
            }
        }
    }

    // 获取计算结果
    getResults() {
        // 计算最大距离
        this.calculateMaxDistance();
        // 计算FSPL
        this.calculateFSPL();

        return {
            fspl: this.fspl,
            maxDistanceKM: this.maxDistanceKM
        };
    }
}