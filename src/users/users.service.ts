import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  /** Crea el usuario si no existe, actualiza si ya existe */
  async upsert(profile: {
    googleId: string;
    email: string;
    name: string;
    picture: string;
  }): Promise<User> {
    let user = await this.repo.findOne({ where: { googleId: profile.googleId } });

    if (!user) {
      user = this.repo.create({ ...profile, appRoles: {} });
    } else {
      user.name    = profile.name;
      user.picture = profile.picture;
    }

    return this.repo.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /** Asigna un rol a un usuario en una app específica */
  async assignRole(userId: string, app: string, role: string): Promise<User> {
    const user = await this.findById(userId);
    const current = user.appRoles[app] ?? [];
    if (!current.includes(role)) {
      user.appRoles = { ...user.appRoles, [app]: [...current, role] };
    }
    return this.repo.save(user);
  }
}
