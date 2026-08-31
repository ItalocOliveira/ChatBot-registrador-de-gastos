import {
  CreateMensagemDto,
  IMensagensRepository,
} from "../interfaces/IMensagensRepository";

export class MensagensService {
  constructor(private readonly mensagensRepository: IMensagensRepository) {}

  async create(data: CreateMensagemDto) {
    return this.mensagensRepository.create(data);
  }
}
