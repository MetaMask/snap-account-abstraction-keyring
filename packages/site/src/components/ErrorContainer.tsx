import React from 'react';
import styled from 'styled-components';

const ErrorBox = styled.div`
  color: #721c24;
`;

export const ErrorContainer = ({ error }: { error: string }) => {
  return <ErrorBox>{error}</ErrorBox>;
};
