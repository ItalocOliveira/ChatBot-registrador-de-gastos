import {
  CreateGastoDto,
  IGastosRepository,
} from "../interfaces/IGastosRepository";

export class GastosService {
  constructor(private readonly gastosRepository: IGastosRepository) {}

  async create(data: CreateGastoDto) {
    return this.gastosRepository.create(data);
  }

  async getGastosDoMes() {
    return this.gastosRepository.getGastosDoMes();
  }
}
