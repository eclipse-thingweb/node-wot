import { ModbusFunction, ModbusEntity } from './modbus';

export function modbusFunctionToEntity(modbusFun: ModbusFunction): ModbusEntity {
  switch (modbusFun) {
    case ModbusFunction.readCoil:
      return 'Coil'
    case ModbusFunction.readDiscreteInput:
      return 'DiscreteInput'
    case ModbusFunction.readInputRegister:
      return 'InputRegister'
    case ModbusFunction.readMultipleHoldingRegisters:
      return 'HoldingRegister'
    case ModbusFunction.writeMultipleCoils:
      return 'Coil'
    case ModbusFunction.writeMultipleHoldingRegisters:
      return 'HoldingRegister'
    case ModbusFunction.writeSingleCoil:
      return 'Coil'
    case ModbusFunction.writeSingleHoldingRegister:
      return 'HoldingRegister'
    default:
      throw new Error('Cannot convert ' + modbusFun + ' to ModbusEntity');
  }
}
