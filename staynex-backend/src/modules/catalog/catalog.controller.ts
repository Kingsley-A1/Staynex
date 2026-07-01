import { Controller, Get, Param, Query } from "@nestjs/common";
import { parseQuery } from "../../common/http";
import { CatalogService } from "./catalog.service";
import { searchQuerySchema } from "./dto";

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("search")
  search(@Query() query: unknown) {
    return this.catalog.search(parseQuery(searchQuerySchema, query));
  }

  @Get("catalog/cities")
  cities() {
    return this.catalog.cities();
  }

  @Get("catalog/home")
  home() {
    return this.catalog.home();
  }

  @Get("stays/:slug")
  detail(@Param("slug") slug: string) {
    return this.catalog.getPublicProperty(slug);
  }
}
