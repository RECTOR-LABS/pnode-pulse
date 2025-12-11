import React, { ChangeEvent } from "react";
import { InlineField, Input, SecretInput } from "@grafana/ui";
import { DataSourcePluginOptionsEditorProps } from "@grafana/data";
import {
  PnodePulseDataSourceOptions,
  PnodePulseSecureOptions,
} from "../datasource/types";

type Props = DataSourcePluginOptionsEditorProps<
  PnodePulseDataSourceOptions,
  PnodePulseSecureOptions
>;

/**
 * Configuration editor for pNode Pulse datasource
 */
export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const { jsonData, secureJsonFields, secureJsonData } = options;

  const onURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        url: event.target.value,
      },
    });
  };

  const onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        apiKey: event.target.value,
      },
    });
  };

  const onResetAPIKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...secureJsonData,
        apiKey: "",
      },
    });
  };

  return (
    <div className="gf-form-group">
      <InlineField
        label="URL"
        labelWidth={12}
        tooltip="pNode Pulse API URL"
      >
        <Input
          onChange={onURLChange}
          value={jsonData.url || "https://pulse.rectorspace.com"}
          placeholder="https://pulse.rectorspace.com"
          width={40}
        />
      </InlineField>

      <InlineField
        label="API Key"
        labelWidth={12}
        tooltip="API key for authenticated requests (optional, provides higher rate limits)"
      >
        <SecretInput
          isConfigured={secureJsonFields?.apiKey ?? false}
          value={secureJsonData?.apiKey || ""}
          placeholder="pk_live_..."
          width={40}
          onReset={onResetAPIKey}
          onChange={onAPIKeyChange}
        />
      </InlineField>

      <div className="gf-form">
        <div className="gf-form-label">
          <a
            href="https://pulse.rectorspace.com/settings/api-keys"
            target="_blank"
            rel="noreferrer"
            className="external-link"
          >
            Get an API key
          </a>
        </div>
      </div>
    </div>
  );
}
