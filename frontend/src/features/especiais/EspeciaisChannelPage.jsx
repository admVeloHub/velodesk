/**

 * EspeciaisChannelPage — workspace do canal selecionado

 */

import React from 'react';

import { Navigate, useNavigate, useParams } from 'react-router-dom';

import {

  getEspeciaisChannel,

  persistEspeciaisChannel,

} from '../../config/especiaisChannels';



export default function EspeciaisChannelPage() {

  const { channelId } = useParams();

  const navigate = useNavigate();

  const channel = getEspeciaisChannel(channelId);



  if (!channel) {

    return <Navigate to="/workspace" replace />;

  }



  persistEspeciaisChannel(channel.id);



  return (

    <div className="page active especiais-page" id={`especiais-${channel.id}`}>

      <div className="eco-page-inner especiais-page__inner">

        <header className="especiais-page__header especiais-page__header--channel">

          <button

            type="button"

            className="especiais-page__back"

            onClick={() => navigate('/workspace')}

          >

            <i className="ti ti-arrow-left" aria-hidden="true" />

            Trocar canal

          </button>

          <span className="especiais-page__eyebrow">Perfil Especiais</span>

          <h2 className="especiais-page__title">{channel.label}</h2>

          <p className="especiais-page__subtitle">{channel.desc}</p>

        </header>



        <div className="especiais-channel-shell">

          <div className="especiais-channel-shell__placeholder">

            <i className={`ti ${channel.icon}`} aria-hidden="true" />

            <p>Área operacional de <strong>{channel.label}</strong> em construção.</p>

          </div>

        </div>

      </div>

    </div>

  );

}


