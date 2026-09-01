import {
  CreateSugestaoDto,
  ISugestoesRepository,
} from "../interfaces/ISugestoesRepository";

export class SugestoesService {
  constructor(private readonly sugestoesRepository: ISugestoesRepository) {}

  async create(data: CreateSugestaoDto) {
    return this.sugestoesRepository.create(data);
  }
}
