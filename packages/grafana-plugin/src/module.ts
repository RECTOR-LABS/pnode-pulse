import { DataSourcePlugin } from "@grafana/data";
import { PnodePulseDataSource } from "./datasource/datasource";
import { ConfigEditor } from "./components/ConfigEditor";
import { QueryEditor } from "./components/QueryEditor";
import { PnodePulseQuery, PnodePulseDataSourceOptions } from "./datasource/types";

export const plugin = new DataSourcePlugin<
  PnodePulseDataSource,
  PnodePulseQuery,
  PnodePulseDataSourceOptions
>(PnodePulseDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
