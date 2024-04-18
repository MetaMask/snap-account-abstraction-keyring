import React from 'react';
import styled from 'styled-components';

const SuccessBox = styled.div`
  color: #155724;
`;

export const SuccessContainer = ({ message }: { message: string }) => {
  return <SuccessBox>{message}</SuccessBox>;
};
