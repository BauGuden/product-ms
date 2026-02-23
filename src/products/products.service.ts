import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/Prisma.service';
import { PaginationDto } from 'src/common';
import { table } from 'console';
import { NotFoundError, take } from 'rxjs';

@Injectable()
export class ProductsService {

  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {

    const product = await this.prisma.product.create({
      data: createProductDto,
    })

    return product;
  }

  async findAll( paginationDto: PaginationDto) {

    const { page, limit } = paginationDto;

    const totalPages = await this.prisma.product.count({
      where: { available: true }
    });

    const lastPage = Math.ceil(totalPages / limit);

    return {
      data: await this.prisma.product.findMany({
        where: { available: true },
        take: limit,
        skip: (page - 1) * limit 
      }),
      meta: {
        total: totalPages,
        page: page,
        lastPage: lastPage
      }
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: id, available: true
      }
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

  }

  async update(id: number, updateProductDto: UpdateProductDto) {

    await this.findOne(id);
    
    return this.prisma.product.update({
      where: { id: id },
      data: updateProductDto
    })

  }

  async remove(id: number) {
    
    await this.findOne(id);

    // return this.prisma.product.delete({
    //   where: { id: id }
    // })

    const product = await this.prisma.product.update({
      where: { id: id },
      data: { 
        available: false 
      }
    });

    return product;

  }
}
